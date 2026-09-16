import type { Component, Pin, Vec3 } from '../../types.js';
import { addMesh } from '../helpers.js';
import {
  addPinHeader,
  HEADER_PITCH_MM,
  headerColumnOffset,
  headerPinTipY,
} from '../parts/pin-header.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** Typical FR-4 thickness for the AliExpress 21 x 10 mm DS18B20 breakout. */
export const DS18B20_PCB_MM = 1.6;
/** TO-92 across the three leads (JEDEC-ish). */
export const TO92_WIDTH_MM = 4.8;
/** Flat face to rounded back. Wider than a half-circle, so the D is a slab plus a semicircle. */
export const TO92_THICK_MM = 3.9;
export const TO92_HEIGHT_MM = 4.8;
export const TO92_LEAD_PITCH_MM = 1.27;
/** Real parts stand off the board; a flush can reads as a blob. */
export const TO92_LEAD_GAP_MM = 1.55;
/** Shorter than a full Dupont tower so 8 mm gold pins do not swallow the 21 x 10 mm board. */
export const DS18B20_HEADER_HEIGHT_MM = 5.4;

function pcbTopY(): number {
  return DS18B20_PCB_MM / 2;
}

function headerCenterX(widthMm: number): number {
  return -widthMm / 2 + HEADER_PITCH_MM / 2;
}

/**
 * Header along the 10 mm edge: GND / DQ / VCC at -Z / 0 / +Z, matching the
 * "VCC DQ GND" silkscreen when the header is read from the opposite end.
 */
export function ds18b20HeaderColumn(pin: Pin): number {
  const id = pin.id.trim().toUpperCase();
  if (id === 'GND' || id === 'G' || id === '-') return 0;
  if (id === 'DQ' || id === 'DATA' || id === 'DAT' || id === 'Q') return 1;
  return 2;
}

export function ds18b20HeaderPinZ(column: number): number {
  return headerColumnOffset(column, 3);
}

export function ds18b20PinTipY(): number {
  return headerPinTipY(pcbTopY(), 'male', DS18B20_HEADER_HEIGHT_MM);
}

export function resolveDs18b20PinPosition(component: Component, pin: Pin): Vec3 {
  return [
    headerCenterX(component.dimensions[0]),
    ds18b20PinTipY(),
    ds18b20HeaderPinZ(ds18b20HeaderColumn(pin)),
  ];
}

function to92Geometry(
  THREE: ThreeModule,
  width: number,
  thick: number,
  height: number,
): import('three').ExtrudeGeometry {
  const halfW = width / 2;
  const slab = Math.max(thick - halfW, 0.25);
  const shape = new THREE.Shape();
  // CCW: flat at x=0, semicircle toward +X.
  shape.moveTo(0, -halfW);
  shape.lineTo(slab, -halfW);
  shape.absarc(slab, 0, halfW, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(0, halfW);
  shape.lineTo(0, -halfW);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 20,
  });
  geom.rotateX(-Math.PI / 2);
  // WHY: gallery camera looks from +Z; yaw the D so the Dallas flat faces the camera
  // instead of presenting the extruded side as a black box.
  geom.rotateY(-Math.PI / 2);
  geom.translate(0, -height / 2, thick / 2);
  geom.computeVertexNormals();
  return geom;
}

function addSmdChip(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  options: {
    length: number;
    width: number;
    height: number;
    position: Vec3;
    name: string;
    body: string;
    cap?: string;
  },
): void {
  const capLen = Math.min(0.45, options.length * 0.22);
  const bodyLen = Math.max(options.length - capLen * 2, options.length * 0.5);
  const y = options.position[1];
  const z = options.position[2];
  const body = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(bodyLen, options.height, options.width),
    new THREE.MeshStandardMaterial({ color: options.body, roughness: 0.55, metalness: 0.08 }),
    options.position,
  );
  body.name = options.name;
  meshes.push(body);
  const capMat = new THREE.MeshStandardMaterial({
    color: options.cap ?? '#c5ccd3',
    roughness: 0.32,
    metalness: 0.4,
  });
  for (const sign of [-1, 1] as const) {
    const cap = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(capLen, options.height * 0.92, options.width),
      capMat,
      [options.position[0] + sign * (bodyLen / 2 + capLen / 2 - 0.04), y, z],
    );
    cap.name = `${options.name}-cap`;
    meshes.push(cap);
  }
}

/**
 * AliExpress 21 x 10 mm DS18B20 breakout: blue PCB, D-shaped TO-92, 103/102 SMD,
 * power LED, and a 3-pin male header. Waterproof capsules stay on kind: probe.
 */
export function buildDs18b20(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, , d] = component.dimensions;
  const pcbH = DS18B20_PCB_MM;
  const pcbTop = pcbTopY();
  const scale = Math.min(1, w / 16, d / 9);
  const to92W = TO92_WIDTH_MM * scale;
  const to92T = TO92_THICK_MM * scale;
  const to92H = TO92_HEIGHT_MM * scale;
  const leadPitch = TO92_LEAD_PITCH_MM * scale;
  const leadGap = TO92_LEAD_GAP_MM * scale;

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, pcbH, d),
    new THREE.MeshStandardMaterial({ color: '#1560b8', roughness: 0.55, metalness: 0.08 }),
  );
  pcb.name = 'ds18b20-pcb';
  meshes.push(pcb);

  const padX = w / 2 - 1.15;
  const to92X = Math.min(w * 0.18, padX - to92W / 2 - 1.2);
  const to92Y = pcbTop + leadGap + to92H / 2;
  const plastic = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.55, metalness: 0.04 });
  const to92 = addMesh(THREE, group, to92Geometry(THREE, to92W, to92T, to92H), plastic, [to92X, to92Y, 0]);
  to92.name = 'ds18b20-to92';
  meshes.push(to92);

  // WHY: a coplanar mark z-fights; the lasered Dallas face sits slightly off the flat toward +Z.
  const mark = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(to92W * 0.62, to92H * 0.62, 0.12),
    new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.7, metalness: 0.02 }),
    [to92X, to92Y, to92T / 2 + 0.02],
  );
  mark.name = 'ds18b20-to92-mark';
  meshes.push(mark);

  const silk = addMesh(
    THREE,
    group,
    to92Geometry(THREE, to92W * 1.22, to92T * 1.18, 0.12),
    new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.7, metalness: 0.02 }),
    [to92X, pcbTop + 0.06, 0],
  );
  silk.name = 'ds18b20-to92-silk';
  meshes.push(silk);

  const leadMetal = new THREE.MeshStandardMaterial({ color: '#c5ccd3', roughness: 0.32, metalness: 0.4 });
  const solder = new THREE.MeshStandardMaterial({ color: '#b7c0c8', roughness: 0.38, metalness: 0.45 });
  const leadW = 0.42 * scale;
  const leadTop = pcbTop + leadGap + 0.2;
  const leadH = Math.max(leadTop - (-pcbTop), 1.2);
  for (let i = 0; i < 3; i += 1) {
    const x = to92X + (i - 1) * leadPitch;
    const z = to92T / 2 - 0.35;
    const lead = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(leadW, leadH, leadW),
      leadMetal,
      [x, (leadTop + -pcbTop) / 2, z],
    );
    lead.name = `ds18b20-lead:${i}`;
    meshes.push(lead);
    const fillet = addMesh(
      THREE,
      group,
      new THREE.SphereGeometry(0.45 * scale, 10, 8),
      solder,
      [x, pcbTop + 0.12, z],
    );
    fillet.scale.set(1, 0.55, 1);
    fillet.name = `ds18b20-solder:${i}`;
    meshes.push(fillet);
  }

  const smdY = pcbTop + 0.32;
  const smdX = (headerCenterX(w) + HEADER_PITCH_MM / 2 + to92X - to92W / 2) / 2;
  addSmdChip(THREE, group, meshes, {
    length: 3.2 * scale,
    width: 1.6 * scale,
    height: 0.55,
    position: [smdX, smdY, d * 0.22],
    name: 'ds18b20-r1',
    body: '#1c1c1c',
  });
  addSmdChip(THREE, group, meshes, {
    length: 2.0 * scale,
    width: 1.25 * scale,
    height: 0.45,
    position: [smdX, smdY - 0.04, d * 0.02],
    name: 'ds18b20-r2',
    body: '#1c1c1c',
  });
  const ledColor = new THREE.Color('#e23d28');
  addSmdChip(THREE, group, meshes, {
    length: 2.0 * scale,
    width: 1.25 * scale,
    height: 0.5,
    position: [smdX + 0.35, smdY, -d * 0.22],
    name: 'ds18b20-led',
    body: '#f2d9c8',
    cap: '#c5ccd3',
  });
  const ledLens = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(1.1 * scale, 0.22, 0.85 * scale),
    new THREE.MeshStandardMaterial({
      color: ledColor,
      roughness: 0.28,
      metalness: 0.05,
      emissive: ledColor,
      emissiveIntensity: 0.35,
    }),
    [smdX + 0.35, smdY + 0.28, -d * 0.22],
  );
  ledLens.name = 'ds18b20-led-lens';
  meshes.push(ledLens);

  const padMat = new THREE.MeshStandardMaterial({ color: '#d7c089', roughness: 0.32, metalness: 0.4 });
  const holeMat = new THREE.MeshStandardMaterial({ color: '#0b0b0b', roughness: 0.78, metalness: 0.08 });
  for (let i = 0; i < 3; i += 1) {
    const z = ds18b20HeaderPinZ(i);
    const ring = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(0.7, 0.7, 0.22, 12),
      padMat,
      [padX, pcbTop + 0.04, z],
    );
    ring.name = `ds18b20-pad:${i}`;
    meshes.push(ring);
    const hole = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(0.32, 0.32, pcbH + 0.2, 10),
      holeMat,
      [padX, 0, z],
    );
    hole.name = `ds18b20-pad-hole:${i}`;
    meshes.push(hole);
  }

  const pinIds = ['GND', 'DQ', 'VDD'] as const;
  for (let column = 0; column < 3; column += 1) {
    addPinHeader(THREE, group, meshes, {
      columns: 1,
      rows: 1,
      along: 'z',
      contact: 'male',
      heightMm: DS18B20_HEADER_HEIGHT_MM,
      pcbTopY: pcbTop,
      center: [headerCenterX(w), 0, ds18b20HeaderPinZ(column)],
      namePrefix: 'ds18b20-header',
      housingName: `ds18b20-header:${column}`,
      pinName: () => `ds18b20-header-pin:${pinIds[column]}`,
      pinUserData: () => ({ kind: 'ds18b20-header-pin', pinId: pinIds[column], column }),
      pinBottomY: -pcbTop - 0.5,
    });
  }

  return { group, meshes };
}

export const ds18b20Model: ModelDefinition = {
  kind: 'ds18b20',
  build: buildDs18b20,
  resolvePinPosition: resolveDs18b20PinPosition,
  hidePinMarkers: true,
};
