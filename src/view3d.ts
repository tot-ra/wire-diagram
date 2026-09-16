import type {
  Component,
  Diagram,
  ModelKind,
  Pin,
  Vec3,
  ViewCallbacks,
  ViewHandle,
  Wire,
} from './types.js';

type ThreeModule = typeof import('three');
type OrbitControlsType = typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
type GLTFLoaderType = typeof import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;
type MeshStandardMaterial = import('three').MeshStandardMaterial;

interface EndpointRef {
  componentId: string;
  pinId: string;
}

interface SceneObject {
  id: string;
  kind: 'component' | 'wire';
  object: import('three').Object3D;
  materials: MeshStandardMaterial[];
  baseEmissive: number[];
  baseColor: import('three').Color[];
}

const DEFAULT_WIRE_DIAMETER_MM = 1.6;
const LABEL_HEIGHT_MM = 4;
const PIN_MARKER_RADIUS_MM = 1.4;

export function parseEndpoint(ref: string): EndpointRef | null {
  const dot = ref.lastIndexOf('.');
  if (dot <= 0 || dot === ref.length - 1) return null;
  return { componentId: ref.slice(0, dot), pinId: ref.slice(dot + 1) };
}

function syncPinWorldPositions(
  THREE: ThreeModule,
  component: Component,
  target: Map<string, import('three').Vector3>,
): void {
  for (const pin of component.pins) {
    const { index, count } = pinIndexOnSide(component, pin);
    const world = resolvePinWorldPosition(THREE, component, pin, index, count);
    target.set(`${component.id}.${pin.id}`, world);
  }
}

function resolvePinLocalPosition(
  component: Component,
  pin: Pin,
  pinIndexOnSide: number,
  pinsOnSide: number,
): Vec3 {
  if (pin.position) return pin.position;
  const [width, height, depth] = component.dimensions;
  const edgeX = pin.side === 'left' ? -width / 2 : width / 2;
  const slot = pinIndexOnSide + 1;
  const slots = Math.max(pinsOnSide, 1) + 1;
  const z = depth * (slot / slots - 0.5);
  const y = height * 0.08;
  return [edgeX, y, z];
}

function resolvePinWorldPosition(
  THREE: ThreeModule,
  component: Component,
  pin: Pin,
  pinIndexOnSide: number,
  pinsOnSide: number,
): import('three').Vector3 {
  const local = resolvePinLocalPosition(component, pin, pinIndexOnSide, pinsOnSide);
  const [cx, cy, cz] = component.position;
  return new THREE.Vector3(cx + local[0], cy + local[1], cz + local[2]);
}

/** Preserve author pin order within each side. */
function pinsBySide(component: Component): { left: Pin[]; right: Pin[] } {
  const left: Pin[] = [];
  const right: Pin[] = [];
  for (const pin of component.pins) {
    if (pin.side === 'left') left.push(pin);
    else right.push(pin);
  }
  return { left, right };
}

function pinIndexOnSide(component: Component, pin: Pin): { index: number; count: number } {
  const grouped = pinsBySide(component);
  const list = pin.side === 'left' ? grouped.left : grouped.right;
  const index = list.findIndex((p) => p.id === pin.id);
  return { index: Math.max(index, 0), count: list.length };
}

function cssColor(THREE: ThreeModule, value: string, fallback = '#888888'): import('three').Color {
  try {
    return new THREE.Color(value);
  } catch {
    return new THREE.Color(fallback);
  }
}

function meshMaterials(mesh: import('three').Mesh): MeshStandardMaterial[] {
  const material = mesh.material;
  if (Array.isArray(material)) {
    return material.filter((entry): entry is MeshStandardMaterial => Boolean(entry));
  }
  return material ? [material as MeshStandardMaterial] : [];
}

function collectMaterialSnapshot(meshes: import('three').Mesh[]): {
  materials: MeshStandardMaterial[];
  baseEmissive: number[];
  baseColor: import('three').Color[];
} {
  const materials: MeshStandardMaterial[] = [];
  const baseEmissive: number[] = [];
  const baseColor: import('three').Color[] = [];
  for (const mesh of meshes) {
    for (const material of meshMaterials(mesh)) {
      materials.push(material);
      baseEmissive.push(material.emissiveIntensity ?? 0);
      baseColor.push(material.color.clone());
    }
  }
  return { materials, baseEmissive, baseColor };
}

function createLabelSprite(
  THREE: ThreeModule,
  text: string,
  tint = '#f5f5f5',
): import('three').Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  const fontSize = 28;
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  const metrics = ctx.measureText(text);
  const padX = 16;
  const padY = 10;
  canvas.width = Math.ceil(metrics.width + padX * 2);
  canvas.height = fontSize + padY * 2;

  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(12, 14, 18, 0.82)';
  const radius = 8;
  const w = canvas.width;
  const h = canvas.height;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(w - radius, 0);
  ctx.quadraticCurveTo(w, 0, w, radius);
  ctx.lineTo(w, h - radius);
  ctx.quadraticCurveTo(w, h, w - radius, h);
  ctx.lineTo(radius, h);
  ctx.quadraticCurveTo(0, h, 0, h - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = tint;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padX, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  const scale = canvas.width / 18;
  sprite.scale.set(scale, (canvas.height / canvas.width) * scale, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function addMesh(
  THREE: ThreeModule,
  group: import('three').Group,
  geometry: import('three').BufferGeometry,
  material: import('three').Material,
  position?: Vec3,
  rotation?: Vec3,
): import('three').Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (position) mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  group.add(mesh);
  return mesh;
}

function buildGenericBoard(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const bodyColor = component.color ? cssColor(THREE, component.color) : new THREE.Color('#1f6b42');

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, h * 0.12, d),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.55,
      metalness: 0.08,
    }),
    [0, 0, 0],
  );
  meshes.push(pcb);

  const silk = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.55, 0.15, d * 0.35),
    new THREE.MeshStandardMaterial({ color: '#ececec', roughness: 0.85, metalness: 0 }),
    [0, h * 0.07, 0],
  );
  meshes.push(silk);

  return { group, meshes };
}

function buildEsp32(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, h * 0.1, d),
    new THREE.MeshStandardMaterial({ color: '#0f2d1d', roughness: 0.62, metalness: 0.12 }),
  );
  meshes.push(pcb);

  const shield = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.42, h * 0.16, d * 0.48),
    new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 0.28, metalness: 0.92 }),
    [0, h * 0.12, 0],
  );
  meshes.push(shield);

  const usb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.16, h * 0.08, d * 0.22),
    new THREE.MeshStandardMaterial({ color: '#c5c8ce', roughness: 0.35, metalness: 0.85 }),
    [-w * 0.34, h * 0.04, -d * 0.34],
  );
  meshes.push(usb);

  const chip = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.18, h * 0.06, d * 0.18),
    new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.4, metalness: 0.2 }),
    [w * 0.18, h * 0.08, d * 0.12],
  );
  meshes.push(chip);

  const antenna = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.08, h * 0.02, d * 0.55),
    new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.45, metalness: 0.75 }),
    [w * 0.34, h * 0.07, d * 0.05],
  );
  meshes.push(antenna);

  for (let i = 0; i < 2; i += 1) {
    const header = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(w * 0.55, h * 0.12, d * 0.08),
      new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.7, metalness: 0.05 }),
      [0, h * 0.1, (i === 0 ? -1 : 1) * d * 0.42],
    );
    meshes.push(header);
  }

  return { group, meshes };
}

function buildHx711(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, h * 0.08, d),
    new THREE.MeshStandardMaterial({ color: '#1f7a3a', roughness: 0.58, metalness: 0.1 }),
  );
  meshes.push(pcb);

  const chip = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.28, h * 0.07, d * 0.38),
    new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.35, metalness: 0.25 }),
    [0, h * 0.08, 0],
  );
  meshes.push(chip);

  for (let i = 0; i < 2; i += 1) {
    const terminal = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(w * 0.12, h * 0.14, d * 0.18),
      new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.55, metalness: 0.35 }),
      [(i === 0 ? -1 : 1) * w * 0.28, h * 0.06, 0],
    );
    meshes.push(terminal);
    const screw = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(w * 0.025, w * 0.025, h * 0.03, 16),
      new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.25, metalness: 0.9 }),
      [(i === 0 ? -1 : 1) * w * 0.28, h * 0.14, 0],
    );
    meshes.push(screw);
  }

  return { group, meshes };
}

function buildLoadCell(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const aluminum = new THREE.MeshStandardMaterial({
    color: '#bfc5cc',
    roughness: 0.32,
    metalness: 0.88,
  });

  const body = addMesh(THREE, group, new THREE.BoxGeometry(w, h * 0.35, d), aluminum);
  meshes.push(body);

  const beam = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.18, h * 0.55, d * 0.22),
    aluminum,
    [0, h * 0.3, 0],
  );
  meshes.push(beam);

  for (const xSign of [-1, 1]) {
    const pad = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(w * 0.07, w * 0.07, h * 0.04, 20),
      new THREE.MeshStandardMaterial({ color: '#8a9099', roughness: 0.4, metalness: 0.75 }),
      [xSign * w * 0.34, -h * 0.18, 0],
    );
    meshes.push(pad);
  }

  return { group, meshes };
}

export function buildProbe(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const length = w;
  const radius = Math.min(h, d) / 2;
  const shrinkLength = length * 0.16;
  const shaftLength = length - shrinkLength;
  const alongX: Vec3 = [0, 0, Math.PI / 2];
  const steel = new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.18, metalness: 0.96 });

  const shrink = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, shrinkLength, 24),
    new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.82, metalness: 0.08 }),
    [-length / 2 + shrinkLength / 2, 0, 0],
    alongX,
  );
  shrink.name = 'probe-shrink';
  meshes.push(shrink);

  const shaft = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius, radius, shaftLength, 28),
    steel,
    [-length / 2 + shrinkLength + shaftLength / 2, 0, 0],
    alongX,
  );
  shaft.name = 'probe-shaft';
  meshes.push(shaft);

  return { group, meshes };
}

export function buildResistor(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const bodyLength = Math.max(w, d);
  const bodyRadius = Math.min(w, d) * 0.35;

  const body = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyLength, 24),
    new THREE.MeshStandardMaterial({ color: '#d8cbb8', roughness: 0.72, metalness: 0.05 }),
    [0, 0, 0],
    [0, 0, Math.PI / 2],
  );
  meshes.push(body);

  if (matchesResistance(component, '4.7 kΩ')) {
    const bandColors = ['#f1c40f', '#7d3c98', '#c0392b', '#d4a017'];
    for (let i = 0; i < bandColors.length; i += 1) {
      const band = addMesh(
        THREE,
        group,
        new THREE.CylinderGeometry(bodyRadius * 1.02, bodyRadius * 1.02, bodyLength * 0.07, 24),
        new THREE.MeshStandardMaterial({ color: bandColors[i], roughness: 0.6, metalness: 0.1 }),
        [bodyLength * (-0.24 + i * 0.16), 0, 0],
        [0, 0, Math.PI / 2],
      );
      band.name = `resistor-band-${i}`;
      meshes.push(band);
    }
  }

  for (const xSign of [-1, 1]) {
    const lead = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(bodyRadius * 0.12, bodyRadius * 0.12, bodyLength * 0.45, 12),
      new THREE.MeshStandardMaterial({ color: '#b0b4ba', roughness: 0.25, metalness: 0.9 }),
      [xSign * bodyLength * 0.62, 0, 0],
      [0, 0, Math.PI / 2],
    );
    meshes.push(lead);
  }

  return { group, meshes };
}

function buildPowerBlock(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const housing = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: '#20242b', roughness: 0.68, metalness: 0.12 }),
  );
  meshes.push(housing);

  const accent = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.82, h * 0.08, d * 0.82),
    new THREE.MeshStandardMaterial({ color: '#3d7be0', roughness: 0.45, metalness: 0.2, emissive: '#1a3f80', emissiveIntensity: 0.25 }),
    [0, h * 0.46, 0],
  );
  meshes.push(accent);

  for (let i = 0; i < 2; i += 1) {
    const terminal = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(w * 0.05, w * 0.05, h * 0.08, 16),
      new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.3, metalness: 0.85 }),
      [(i === 0 ? -1 : 1) * w * 0.28, h * 0.52, 0],
    );
    meshes.push(terminal);
  }

  return { group, meshes };
}

function buildBuiltinModel(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const builders: Record<ModelKind, (t: ThreeModule, c: Component) => { group: import('three').Group; meshes: import('three').Mesh[] }> = {
    board: buildGenericBoard,
    esp32: buildEsp32,
    hx711: buildHx711,
    'load-cell': buildLoadCell,
    probe: buildProbe,
    resistor: buildResistor,
    power: buildPowerBlock,
  };
  return builders[component.kind](THREE, component);
}

function addPinMarkers(
  THREE: ThreeModule,
  root: import('three').Group,
  component: Component,
): import('three').Mesh[] {
  const markers: import('three').Mesh[] = [];
  const markerMaterial = new THREE.MeshStandardMaterial({
    color: '#facc15',
    emissive: '#ca8a04',
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.15,
  });

  for (const pin of component.pins) {
    const { index, count } = pinIndexOnSide(component, pin);
    const local = resolvePinLocalPosition(component, pin, index, count);
    const marker = addMesh(
      THREE,
      root,
      new THREE.SphereGeometry(PIN_MARKER_RADIUS_MM, 14, 14),
      markerMaterial,
      local,
    );
    marker.name = `pin-marker:${component.id}.${pin.id}`;
    marker.userData = { pinId: pin.id, kind: 'pin-marker' };
    markers.push(marker);
  }

  return markers;
}

function lowestComponentY(diagram: Diagram): number {
  let minY = 0;
  for (const component of diagram.components) {
    const [, cy] = component.position;
    const halfH = component.dimensions[1] / 2;
    minY = Math.min(minY, cy - halfH);
  }
  return minY;
}

function createWireTube(
  THREE: ThreeModule,
  wire: Wire,
  from: import('three').Vector3,
  to: import('three').Vector3,
): import('three').Mesh {
  const span = from.distanceTo(to);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  mid.y += Math.max(span * 0.22, 8);

  const curve = new THREE.CatmullRomCurve3([from.clone(), mid, to.clone()]);
  const radius = (wire.diameterMm ?? DEFAULT_WIRE_DIAMETER_MM) / 2;
  const tubularSegments = Math.max(12, Math.ceil(span / 4));
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 10, false);
  const material = new THREE.MeshStandardMaterial({
    color: cssColor(THREE, wire.color, '#cccccc'),
    roughness: 0.45,
    metalness: 0.08,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function collectMeshes(root: import('three').Object3D): import('three').Mesh[] {
  const meshes: import('three').Mesh[] = [];
  root.traverse((obj) => {
    if ((obj as import('three').Mesh).isMesh) meshes.push(obj as import('three').Mesh);
  });
  return meshes;
}

function disposeMaterial(
  material: import('three').Material,
  seen: Set<import('three').Material>,
): void {
  if (seen.has(material)) return;
  seen.add(material);
  material.dispose();
  for (const key of Object.keys(material)) {
    const value = (material as unknown as Record<string, unknown>)[key];
    if (value && typeof value === 'object' && 'dispose' in value && typeof (value as { dispose: () => void }).dispose === 'function') {
      (value as { dispose: () => void }).dispose();
    }
  }
}

function disposeObject3D(obj: import('three').Object3D, seenMaterials = new Set<import('three').Material>()): void {
  obj.traverse((child) => {
    const mesh = child as import('three').Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (material) disposeMaterial(material, seenMaterials);
      }
    }
    const sprite = child as import('three').Sprite;
    if (sprite.isSprite) {
      sprite.material.map?.dispose();
      disposeMaterial(sprite.material, seenMaterials);
    }
  });
}

function cloneMeshMaterials(root: import('three').Object3D): void {
  root.traverse((child) => {
    const mesh = child as import('three').Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((entry) => entry.clone());
      return;
    }
    mesh.material = mesh.material.clone();
  });
}

function normalizeResistance(value: string): string {
  return value.replace(/\s+/g, '').replace(/Ω/gi, 'ω').toLowerCase();
}

export function matchesResistance(component: Component, expected: string): boolean {
  const resistance = component.properties?.resistance;
  if (typeof resistance !== 'string') return false;
  return normalizeResistance(resistance) === normalizeResistance(expected);
}

export function create3DView(host: HTMLElement, diagram: Diagram, callbacks: ViewCallbacks): ViewHandle {
  let disposed = false;
  let selectedId: string | null = null;
  let hoveredId: string | null = null;
  let renderScheduled = false;
  let animationFrame = 0;

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${diagram.title} 3D wiring diagram`);
  host.replaceChildren(canvas);

  const sceneObjects = new Map<string, SceneObject>();
  const pinWorldPositions = new Map<string, import('three').Vector3>();
  const disposables: Array<() => void> = [];

  let THREE!: ThreeModule;
  let renderer!: import('three').WebGLRenderer;
  let scene!: import('three').Scene;
  let camera!: import('three').PerspectiveCamera;
  let controls!: InstanceType<OrbitControlsType>;
  let raycaster!: import('three').Raycaster;
  let pointer!: import('three').Vector2;
  let defaultCameraPosition!: import('three').Vector3;
  let defaultTarget!: import('three').Vector3;
  let GLTFLoaderCtor!: GLTFLoaderType;
  let initialized = false;

  const cleanupPartialInit = (): void => {
    cancelAnimationFrame(animationFrame);
    renderScheduled = false;
    controls?.dispose();
    for (const entry of sceneObjects.values()) disposeObject3D(entry.object);
    sceneObjects.clear();
    pinWorldPositions.clear();
    if (scene) disposeObject3D(scene);
    renderer?.dispose();
    initialized = false;
  };

  const scheduleRender = (): void => {
    if (disposed || !initialized || renderScheduled) return;
    renderScheduled = true;
    const tick = (): void => {
      if (disposed || !initialized) {
        renderScheduled = false;
        return;
      }
      const needsMore = controls.update();
      renderer.render(scene, camera);
      if (needsMore) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        renderScheduled = false;
      }
    };
    animationFrame = requestAnimationFrame(tick);
  };

  const applyHighlight = (id: string | null, hoverId: string | null): void => {
    if (!initialized || disposed) return;
    for (const entry of sceneObjects.values()) {
      const selected = id === entry.id;
      const hovered = hoverId === entry.id && hoverId !== id;
      entry.materials.forEach((material, index) => {
        if (!material.emissive) return;
        material.color.copy(entry.baseColor[index] ?? material.color);
        material.emissive.set(entry.baseColor[index] ?? material.color);
        material.emissiveIntensity = selected ? 0.55 : hovered ? 0.28 : entry.baseEmissive[index] ?? 0;
        if (selected) material.color.offsetHSL(0, 0, 0.08);
      });
    }
    scheduleRender();
  };

  const fitCamera = (): void => {
    if (!initialized || disposed) return;
    const box = new THREE.Box3();
    for (const entry of sceneObjects.values()) {
      box.expandByObject(entry.object);
    }
    if (box.isEmpty()) {
      defaultCameraPosition = new THREE.Vector3(120, 90, 140);
      defaultTarget = new THREE.Vector3(0, 0, 0);
      camera.position.copy(defaultCameraPosition);
      controls.target.copy(defaultTarget);
      controls.update();
      return;
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 40);
    const distance = maxDim * 1.8;
    defaultTarget = center.clone();
    defaultCameraPosition = center.clone().add(new THREE.Vector3(distance * 0.85, distance * 0.55, distance));
    camera.position.copy(defaultCameraPosition);
    controls.target.copy(defaultTarget);
    controls.update();
  };

  const resolvePinPosition = (endpoint: string): import('three').Vector3 | null => {
    const cached = pinWorldPositions.get(endpoint);
    if (cached) return cached.clone();
    const parsed = parseEndpoint(endpoint);
    if (!parsed) return null;
    const component = diagram.components.find((c) => c.id === parsed.componentId);
    if (!component) return null;
    const pin = component.pins.find((p) => p.id === parsed.pinId);
    if (!pin) return null;
    const { index, count } = pinIndexOnSide(component, pin);
    return resolvePinWorldPosition(THREE, component, pin, index, count);
  };

  const refreshComponentMeshes = (componentId: string, root: import('three').Group): void => {
    const meshes = collectMeshes(root);
    const snapshot = collectMaterialSnapshot(meshes);
    sceneObjects.set(componentId, {
      id: componentId,
      kind: 'component',
      object: root,
      materials: snapshot.materials,
      baseEmissive: snapshot.baseEmissive,
      baseColor: snapshot.baseColor,
    });
  };

  const registerComponent = (component: Component): void => {
    const [x, y, z] = component.position;
    syncPinWorldPositions(THREE, component, pinWorldPositions);

    const root = new THREE.Group();
    root.position.set(x, y, z);
    root.userData = { id: component.id, kind: 'component' };

    const builtin = buildBuiltinModel(THREE, component);
    builtin.group.name = 'builtin-model';
    root.add(builtin.group);

    const pinMarkers = addPinMarkers(THREE, root, component);
    for (const marker of pinMarkers) {
      marker.renderOrder = 5;
    }

    const label = createLabelSprite(THREE, component.label);
    label.position.set(0, component.dimensions[1] / 2 + LABEL_HEIGHT_MM, 0);
    root.add(label);

    scene.add(root);
    refreshComponentMeshes(component.id, root);

    if (component.model?.url) {
      const loader = new GLTFLoaderCtor();
      loader.load(
        component.model.url,
        (gltf) => {
          if (disposed) {
            disposeObject3D(gltf.scene);
            return;
          }
          const existingBuiltin = root.getObjectByName('builtin-model');
          if (existingBuiltin) {
            root.remove(existingBuiltin);
            disposeObject3D(existingBuiltin);
          }
          const modelRoot = gltf.scene;
          modelRoot.name = 'external-model';
          cloneMeshMaterials(modelRoot);
          const scale = component.model?.scale ?? 1;
          modelRoot.scale.setScalar(scale);
          if (component.model?.rotation) {
            const [rx, ry, rz] = component.model.rotation;
            modelRoot.rotation.set(rx, ry, rz);
          }
          root.add(modelRoot);
          refreshComponentMeshes(component.id, root);
          fitCamera();
          applyHighlight(selectedId, hoveredId);
          scheduleRender();
        },
        undefined,
        (error) => {
          if (disposed) return;
          callbacks.onError?.(
            `Failed to load model for ${component.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
          scheduleRender();
        },
      );
    }
  };

  const init = async (): Promise<void> => {
    try {
      const [threeModule, controlsModule, loaderModule] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
      ]);
      if (disposed) return;

      THREE = threeModule;
      const OrbitControls = controlsModule.OrbitControls;
      GLTFLoaderCtor = loaderModule.GLTFLoader;

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      if (!renderer.getContext()) {
        renderer.dispose();
        throw new Error('WebGL not available');
      }
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#eef1f5');

      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
      camera.position.set(120, 90, 140);

      controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.target.set(0, 0, 0);
      controls.addEventListener('change', scheduleRender);

      raycaster = new THREE.Raycaster();
      pointer = new THREE.Vector2();

      scene.add(new THREE.HemisphereLight('#f7f9fc', '#5a6472', 0.72));
      const key = new THREE.DirectionalLight('#ffffff', 1.35);
      key.position.set(120, 180, 80);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);
      const fill = new THREE.DirectionalLight('#d8e4ff', 0.58);
      fill.position.set(-90, 60, -120);
      scene.add(fill);
      const rim = new THREE.DirectionalLight('#ffffff', 0.62);
      rim.position.set(-60, 70, 150);
      scene.add(rim);

      const groundY = lowestComponentY(diagram) - 2;
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshStandardMaterial({ color: '#e3e7ed', roughness: 0.95, metalness: 0 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = groundY;
      ground.receiveShadow = true;
      scene.add(ground);
      scene.add(new THREE.GridHelper(800, 40, '#c5ccd6', '#d8dde6'));

      for (const component of diagram.components) {
        registerComponent(component);
      }

      for (const wire of diagram.wires) {
        const from = resolvePinPosition(wire.from);
        const to = resolvePinPosition(wire.to);
        if (!from || !to) {
          if (!disposed) {
            callbacks.onError?.(`Wire ${wire.id}: invalid endpoint ${!from ? wire.from : wire.to}`);
          }
          continue;
        }
        const mesh = createWireTube(THREE, wire, from, to);
        mesh.userData = { id: wire.id, kind: 'wire' };
        scene.add(mesh);
        const snapshot = collectMaterialSnapshot([mesh]);
        sceneObjects.set(wire.id, {
          id: wire.id,
          kind: 'wire',
          object: mesh,
          materials: snapshot.materials,
          baseEmissive: snapshot.baseEmissive,
          baseColor: snapshot.baseColor,
        });
      }

      fitCamera();
      initialized = true;
      resize();
      applyHighlight(selectedId, hoveredId);
      scheduleRender();
    } catch (error) {
      cleanupPartialInit();
      if (!disposed) {
        callbacks.onError?.(
          `Failed to initialize 3D view: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

  const resize = (): void => {
    if (!initialized || disposed) return;
    const width = host.clientWidth || 640;
    const height = host.clientHeight || 480;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    scheduleRender();
  };

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(host);
  disposables.push(() => resizeObserver.disconnect());

  const pick = (event: PointerEvent): string | null => {
    if (!initialized || disposed) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(
      [...sceneObjects.values()].map((entry) => entry.object),
      true,
    );
    for (const hit of hits) {
      let obj: import('three').Object3D | null = hit.object;
      while (obj) {
        if (obj.userData?.id) return obj.userData.id as string;
        obj = obj.parent;
      }
    }
    return null;
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (disposed) return;
    const id = pick(event);
    if (id === hoveredId) return;
    hoveredId = id;
    applyHighlight(selectedId, hoveredId);
    callbacks.onHover(id);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (disposed) return;
    const id = pick(event);
    selectedId = id;
    applyHighlight(selectedId, hoveredId);
    callbacks.onSelect(id);
  };

  const onPointerLeave = (): void => {
    if (disposed) return;
    hoveredId = null;
    applyHighlight(selectedId, hoveredId);
    callbacks.onHover(null);
  };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerleave', onPointerLeave);
  disposables.push(() => {
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerleave', onPointerLeave);
  });

  void init();

  return {
    select(id: string | null): void {
      // Programmatic synchronization must not emit another user selection event.
      selectedId = id;
      applyHighlight(selectedId, hoveredId);
    },
    reset(): void {
      if (disposed || !initialized) return;
      camera.position.copy(defaultCameraPosition);
      controls.target.copy(defaultTarget);
      controls.update();
      scheduleRender();
    },
    destroy(): void {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(animationFrame);
      for (const dispose of disposables) dispose();
      for (const entry of sceneObjects.values()) disposeObject3D(entry.object);
      sceneObjects.clear();
      pinWorldPositions.clear();
      if (scene) disposeObject3D(scene);
      controls?.dispose();
      renderer?.dispose();
      host.replaceChildren();
    },
  };
}
