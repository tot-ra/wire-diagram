import type { Component, Pin, Vec3 } from '../../types.js';
import { addMesh } from '../helpers.js';
import { localPinPosition, pinIndexOnSide } from '../layout.js';
import {
  addPinHeader,
  createHeaderLook,
  HEADER_HEIGHT_MM,
  HEADER_PITCH_MM,
  HEADER_PIN_PROUD_MM,
  HEADER_PIN_SIZE_MM,
  HEADER_SINK_MM,
  headerColumnOffset,
  headerHousingTopY,
  headerPinTipY,
  headerSlotIndex,
  headerStart,
} from '../parts/pin-header.js';
import { addUsbC, USB_C_MM } from '../parts/usb.js';
import type { ModelDefinition, PinLayoutContext, ThreeModule } from '../types.js';

/** Illustrative ESP32-DevKitC dual male header. Real boards vary; authors may override pin.position. */
export const ESP32_HEADER_PITCH_MM = HEADER_PITCH_MM;
export const ESP32_HEADER_PIN_COUNT = 19;
export const ESP32_PCB_THICKNESS_MM = 1.6;
export const ESP32_HEADER_HEIGHT_MM = HEADER_HEIGHT_MM;
export const ESP32_HEADER_SINK_MM = HEADER_SINK_MM;
export const ESP32_PIN_PROUD_MM = HEADER_PIN_PROUD_MM;
export const ESP32_PIN_SIZE_MM = HEADER_PIN_SIZE_MM;

/** ESP32-WROOM-32 datasheet envelope. Antenna occupies the last ~6.2 mm. */
export const ESP32_WROOM_L_MM = 25.5;
export const ESP32_WROOM_W_MM = 18.0;
export const ESP32_WROOM_H_MM = 3.1;
export const ESP32_WROOM_PCB_MM = 0.8;
export const ESP32_WROOM_ANTENNA_MM = 6.2;

export function esp32HeaderStartX(): number {
  return headerStart(ESP32_HEADER_PIN_COUNT);
}

export function esp32HeaderPinX(index: number): number {
  return headerColumnOffset(index, ESP32_HEADER_PIN_COUNT);
}

export function esp32HeaderSlotIndex(x: number): number {
  return headerSlotIndex(x, ESP32_HEADER_PIN_COUNT);
}

/** Schematic left maps to the +Z header row, right to -Z, matching the demo DevKit layout. */
export function esp32HeaderRowZ(depthMm: number, side: 'left' | 'right'): number {
  const z = depthMm / 2 - ESP32_HEADER_PITCH_MM / 2;
  return side === 'left' ? z : -z;
}

export function esp32HeaderHousingTopY(): number {
  return headerHousingTopY(ESP32_PCB_THICKNESS_MM / 2);
}

/** Wire attaches at the gold pin top, slightly above the plastic so the tube meets metal. */
export function esp32PinTipY(): number {
  return headerPinTipY(ESP32_PCB_THICKNESS_MM / 2, 'male');
}

export function resolveEsp32PinPosition(component: Component, pin: Pin, context: PinLayoutContext): Vec3 {
  // WHY: DevKit headers sit on the long edges (±Z), not the USB/antenna short edges (±X).
  return [esp32HeaderPinX(context.index), esp32PinTipY(), esp32HeaderRowZ(component.dimensions[2], pin.side)];
}

function pinSlotKey(side: 'left' | 'right', index: number): string {
  return `${side}:${index}`;
}

function addLed(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  position: Vec3,
  color: string,
  name: string,
): void {
  const led = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(1.6, 0.55, 0.8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.08, emissive: color, emissiveIntensity: 0.28 }),
    position,
  );
  led.name = name;
  meshes.push(led);
}

function addButton(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  position: Vec3,
  name: string,
  plastic: import('three').Material,
): void {
  const pcbTop = ESP32_PCB_THICKNESS_MM / 2;
  const housing = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(6.0, 3.4, 6.0),
    plastic,
    [position[0], pcbTop + 1.7, position[2]],
  );
  housing.name = name;
  meshes.push(housing);
  const cap = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(1.45, 1.45, 1.15, 14),
    new THREE.MeshStandardMaterial({ color: '#ece6d8', roughness: 0.55, metalness: 0.04 }),
    [position[0], pcbTop + 3.85, position[2]],
  );
  cap.name = `${name}-cap`;
  meshes.push(cap);
}

/**
 * Cheap AliExpress 38-pin USB-C ESP32-WROOM-32 DevKit clone (item 1005011654004220
 * was traffic-blocked). Black PCB, Type-C, EN/BOOT, CH340, AMS1117, WROOM-32.
 * Illustrative silhouette, not a verified pin map. Header grid stays 19 x 2.54 mm.
 */
export function buildEsp32(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, , d] = component.dimensions;
  const pcbTop = ESP32_PCB_THICKNESS_MM / 2;
  const plastic = new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.62, metalness: 0.1 });
  const chip = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.48, metalness: 0.16 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c5ccd3', roughness: 0.34, metalness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d7c089', roughness: 0.32, metalness: 0.42 });
  const moduleFr4 = new THREE.MeshStandardMaterial({ color: '#161616', roughness: 0.58, metalness: 0.08 });

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, ESP32_PCB_THICKNESS_MM, d),
    new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.58, metalness: 0.08 }),
  );
  pcb.name = 'esp32-pcb';
  meshes.push(pcb);

  addUsbC(THREE, group, meshes, {
    position: [-w / 2 + USB_C_MM.depth / 2 - 1.3, pcbTop + USB_C_MM.height / 2 - 0.12, 0],
    facing: '-x',
    namePrefix: 'esp32-usb',
    // WHY: default USB silver blows out to white on this dark board under hemisphere light.
    look: {
      shell: metal,
      cavity: new THREE.MeshStandardMaterial({ color: '#14161a', roughness: 0.72, metalness: 0.12 }),
      tongue: new THREE.MeshStandardMaterial({ color: '#c5cad1', roughness: 0.48, metalness: 0.18 }),
    },
  });

  addButton(THREE, group, meshes, [-w / 2 + 11.0, 0, 6.4], 'esp32-boot', plastic);
  addButton(THREE, group, meshes, [-w / 2 + 11.0, 0, -6.4], 'esp32-en', plastic);

  const uart = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(9.9, 1.15, 6.0),
    chip,
    [-w / 2 + 19.5, pcbTop + 0.58, 2.6],
  );
  uart.name = 'esp32-uart';
  meshes.push(uart);

  const ldo = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(6.6, 1.7, 3.6),
    chip,
    [-w / 2 + 19.2, pcbTop + 0.85, -3.6],
  );
  ldo.name = 'esp32-ldo';
  meshes.push(ldo);
  const ldoTab = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(3.2, 0.45, 3.2),
    metal,
    [-w / 2 + 22.6, pcbTop + 0.28, -3.6],
  );
  ldoTab.name = 'esp32-ldo-tab';
  meshes.push(ldoTab);

  const crystal = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(5.0, 1.25, 3.2),
    metal,
    [-w / 2 + 19.6, pcbTop + 0.62, -0.2],
  );
  crystal.name = 'esp32-crystal';
  meshes.push(crystal);

  const cap = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(1.7, 1.7, 3.8, 14),
    new THREE.MeshStandardMaterial({ color: '#1c3f8c', roughness: 0.48, metalness: 0.16 }),
    [-w / 2 + 24.2, pcbTop + 1.9, -4.0],
  );
  cap.name = 'esp32-cap';
  meshes.push(cap);

  addLed(THREE, group, meshes, [-w / 2 + 23.6, pcbTop + 0.35, 8.0], '#d94a3a', 'esp32-led-pwr');
  addLed(THREE, group, meshes, [-w / 2 + 23.6, pcbTop + 0.35, 9.2], '#3dcc6a', 'esp32-led-tx');
  addLed(THREE, group, meshes, [-w / 2 + 23.6, pcbTop + 0.35, 10.4], '#3dcc6a', 'esp32-led-rx');

  const moduleW = Math.min(ESP32_WROOM_W_MM, Math.max(12, d - 7));
  const moduleL = Math.min(ESP32_WROOM_L_MM, w * 0.55);
  const moduleX = w / 2 - moduleL / 2 - 0.4;
  const moduleY = pcbTop + ESP32_WROOM_PCB_MM / 2;
  const module = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(moduleL, ESP32_WROOM_PCB_MM, moduleW),
    moduleFr4,
    [moduleX, moduleY, 0],
  );
  module.name = 'esp32-module';
  meshes.push(module);

  const shieldL = moduleL - ESP32_WROOM_ANTENNA_MM - 0.9;
  const shieldH = ESP32_WROOM_H_MM - ESP32_WROOM_PCB_MM;
  const shieldX = moduleX - moduleL / 2 + 0.45 + shieldL / 2;
  const shield = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(shieldL, shieldH, moduleW - 1.6),
    metal,
    [shieldX, pcbTop + ESP32_WROOM_PCB_MM + shieldH / 2, 0],
  );
  shield.name = 'esp32-shield';
  meshes.push(shield);

  // WHY: a flush badge on the can z-fights; the mark crosses the shield top by a fraction of a millimetre.
  const mark = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(shieldL * 0.42, 0.22, (moduleW - 1.6) * 0.38),
    new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.4, metalness: 0.28 }),
    [shieldX - 1.2, pcbTop + ESP32_WROOM_PCB_MM + shieldH - 0.02, 0],
  );
  mark.name = 'esp32-shield-mark';
  mark.receiveShadow = false;
  meshes.push(mark);

  const antennaX = moduleX + moduleL / 2 - ESP32_WROOM_ANTENNA_MM / 2;
  const antenna = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(ESP32_WROOM_ANTENNA_MM - 0.4, 0.12, moduleW * 0.78),
    new THREE.MeshStandardMaterial({ color: '#3a3228', roughness: 0.62, metalness: 0.08 }),
    [antennaX, pcbTop + ESP32_WROOM_PCB_MM + 0.02, 0],
  );
  antenna.name = 'esp32-antenna';
  meshes.push(antenna);

  // WHY: a solid gold slab read as a badge. WROOM uses an inverted-F PCB antenna on the module end.
  const traces: Array<{ size: Vec3; pos: Vec3 }> = [
    { size: [0.45, 0.16, moduleW * 0.62], pos: [antennaX + 1.9, pcbTop + ESP32_WROOM_PCB_MM + 0.12, 0] },
    { size: [ESP32_WROOM_ANTENNA_MM * 0.72, 0.16, 0.45], pos: [antennaX, pcbTop + ESP32_WROOM_PCB_MM + 0.12, moduleW * 0.28] },
    { size: [ESP32_WROOM_ANTENNA_MM * 0.42, 0.16, 0.45], pos: [antennaX - 0.4, pcbTop + ESP32_WROOM_PCB_MM + 0.12, 0.2] },
    { size: [0.45, 0.16, moduleW * 0.22], pos: [antennaX - 1.4, pcbTop + ESP32_WROOM_PCB_MM + 0.12, -moduleW * 0.12] },
  ];
  traces.forEach((trace, index) => {
    const mesh = addMesh(THREE, group, new THREE.BoxGeometry(...trace.size), gold, trace.pos);
    mesh.name = `esp32-antenna-trace:${index}`;
    meshes.push(mesh);
  });

  for (let i = 0; i < 8; i += 1) {
    const px = moduleX - moduleL / 2 + 1.6 + i * ((shieldL - 1.2) / 7);
    for (const side of [-1, 1] as const) {
      const pad = addMesh(
        THREE,
        group,
        new THREE.BoxGeometry(1.05, 0.28, 0.7),
        gold,
        [px, pcbTop + ESP32_WROOM_PCB_MM / 2, side * (moduleW / 2 - 0.15)],
      );
      pad.name = `esp32-module-pad:${side < 0 ? 'neg' : 'pos'}:${i}`;
      meshes.push(pad);
    }
  }

  const usedBySlot = new Map<string, Pin>();
  for (const pin of component.pins) {
    const local = localPinPosition(component, pin);
    const index = pin.position ? esp32HeaderSlotIndex(local[0]) : pinIndexOnSide(component, pin).index;
    usedBySlot.set(pinSlotKey(pin.side, index), pin);
  }

  const look = createHeaderLook(THREE);
  const pinBottomY = -pcbTop - 0.5;
  for (const side of ['left', 'right'] as const) {
    addPinHeader(THREE, group, meshes, {
      columns: ESP32_HEADER_PIN_COUNT,
      rows: 1,
      contact: 'male',
      pcbTopY: pcbTop,
      center: [0, 0, esp32HeaderRowZ(d, side)],
      look,
      pinBottomY,
      namePrefix: 'esp32-header',
      housingName: `esp32-header-housing:${side}`,
      pinName: (_row, column) => {
        const pinDef = usedBySlot.get(pinSlotKey(side, column));
        return pinDef ? `esp32-header-pin:${pinDef.id}` : `esp32-header-pin:${side}:${column}`;
      },
      pinUserData: (row, column) => {
        const pinDef = usedBySlot.get(pinSlotKey(side, column));
        return { kind: 'esp32-header-pin', pinId: pinDef?.id, side, index: column, row };
      },
    });
  }

  return { group, meshes };
}

export const esp32Model: ModelDefinition = {
  kind: 'esp32',
  build: buildEsp32,
  resolvePinPosition: resolveEsp32PinPosition,
  hidePinMarkers: true,
};
