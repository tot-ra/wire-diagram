import type { Component, Pin, Vec3 } from '../../types.js';
import { addMesh } from '../helpers.js';
import { localPinPosition, pinIndexOnSide } from '../layout.js';
import type { ModelDefinition, PinLayoutContext, ThreeModule } from '../types.js';

/** Illustrative ESP32-DevKitC dual female header. Real boards vary; authors may override pin.position. */
export const ESP32_HEADER_PITCH_MM = 2.54;
export const ESP32_HEADER_PIN_COUNT = 19;
export const ESP32_PCB_THICKNESS_MM = 1.6;
export const ESP32_HEADER_HEIGHT_MM = 8.4;
export const ESP32_HEADER_SINK_MM = 0.2;
export const ESP32_PIN_PROUD_MM = 1.2;
export const ESP32_PIN_SIZE_MM = 0.64;

export function esp32HeaderStartX(): number {
  return -((ESP32_HEADER_PIN_COUNT - 1) * ESP32_HEADER_PITCH_MM) / 2;
}

export function esp32HeaderPinX(index: number): number {
  const clamped = Math.max(0, Math.min(ESP32_HEADER_PIN_COUNT - 1, index));
  return esp32HeaderStartX() + clamped * ESP32_HEADER_PITCH_MM;
}

export function esp32HeaderSlotIndex(x: number): number {
  return Math.max(
    0,
    Math.min(ESP32_HEADER_PIN_COUNT - 1, Math.round((x - esp32HeaderStartX()) / ESP32_HEADER_PITCH_MM)),
  );
}

/** Schematic left maps to the +Z header row, right to -Z, matching the demo DevKit layout. */
export function esp32HeaderRowZ(depthMm: number, side: 'left' | 'right'): number {
  const z = depthMm / 2 - ESP32_HEADER_PITCH_MM / 2;
  return side === 'left' ? z : -z;
}

export function esp32HeaderHousingTopY(): number {
  return ESP32_PCB_THICKNESS_MM / 2 - ESP32_HEADER_SINK_MM + ESP32_HEADER_HEIGHT_MM;
}

/** Wire attaches at the gold pin top, slightly above the plastic so the tube meets metal. */
export function esp32PinTipY(): number {
  return esp32HeaderHousingTopY() + ESP32_PIN_PROUD_MM;
}

export function resolveEsp32PinPosition(component: Component, pin: Pin, context: PinLayoutContext): Vec3 {
  // WHY: DevKit headers sit on the long edges (±Z), not the USB/antenna short edges (±X).
  return [esp32HeaderPinX(context.index), esp32PinTipY(), esp32HeaderRowZ(component.dimensions[2], pin.side)];
}

function pinSlotKey(side: 'left' | 'right', index: number): string {
  return `${side}:${index}`;
}

export function buildEsp32(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, , d] = component.dimensions;
  const pcbTop = ESP32_PCB_THICKNESS_MM / 2;
  const pinTop = esp32PinTipY();
  const pinBottom = -pcbTop - 0.5;
  const pinHeight = pinTop - pinBottom;
  const pinCenterY = (pinTop + pinBottom) / 2;

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, ESP32_PCB_THICKNESS_MM, d),
    new THREE.MeshStandardMaterial({ color: '#0f2d1d', roughness: 0.62, metalness: 0.12 }),
  );
  pcb.name = 'esp32-pcb';
  meshes.push(pcb);

  const shieldH = 3.1;
  const shield = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(Math.min(w * 0.42, 18), shieldH, Math.min(d * 0.58, 16)),
    new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 0.28, metalness: 0.92 }),
    [w * 0.06, pcbTop + shieldH / 2 - ESP32_HEADER_SINK_MM, 0],
  );
  shield.name = 'esp32-shield';
  meshes.push(shield);

  const usbSize: Vec3 = [7.5, 3.2, 8];
  const usb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(usbSize[0], usbSize[1], usbSize[2]),
    new THREE.MeshStandardMaterial({ color: '#c5c8ce', roughness: 0.35, metalness: 0.85 }),
    [-w / 2 + usbSize[0] / 2, pcbTop + usbSize[1] / 2 - ESP32_HEADER_SINK_MM, 0],
  );
  usb.name = 'esp32-usb';
  meshes.push(usb);

  const antennaH = 0.3;
  const antenna = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.12, antennaH, d * 0.42),
    new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.45, metalness: 0.75 }),
    [w / 2 - w * 0.08, pcbTop + antennaH / 2 - 0.08, 0],
  );
  antenna.name = 'esp32-antenna';
  meshes.push(antenna);

  const housingLength = ESP32_HEADER_PIN_COUNT * ESP32_HEADER_PITCH_MM;
  const housingCenterY = pcbTop - ESP32_HEADER_SINK_MM + ESP32_HEADER_HEIGHT_MM / 2;
  const housingMat = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.72, metalness: 0.04 });
  const pinMat = new THREE.MeshStandardMaterial({ color: '#d7c089', roughness: 0.28, metalness: 0.92 });

  const usedBySlot = new Map<string, Pin>();
  for (const pin of component.pins) {
    const local = localPinPosition(component, pin);
    const index = pin.position ? esp32HeaderSlotIndex(local[0]) : pinIndexOnSide(component, pin).index;
    usedBySlot.set(pinSlotKey(pin.side, index), pin);
  }

  for (const side of ['left', 'right'] as const) {
    const rowZ = esp32HeaderRowZ(d, side);
    const housing = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(housingLength, ESP32_HEADER_HEIGHT_MM, ESP32_HEADER_PITCH_MM),
      housingMat,
      [0, housingCenterY, rowZ],
    );
    housing.name = `esp32-header-housing:${side}`;
    meshes.push(housing);

    for (let index = 0; index < ESP32_HEADER_PIN_COUNT; index += 1) {
      const pinDef = usedBySlot.get(pinSlotKey(side, index));
      const x = esp32HeaderPinX(index);
      const pinMesh = addMesh(
        THREE,
        group,
        new THREE.BoxGeometry(ESP32_PIN_SIZE_MM, pinHeight, ESP32_PIN_SIZE_MM),
        pinMat,
        [x, pinCenterY, rowZ],
      );
      pinMesh.name = pinDef ? `esp32-header-pin:${pinDef.id}` : `esp32-header-pin:${side}:${index}`;
      pinMesh.userData = { kind: 'esp32-header-pin', pinId: pinDef?.id, side, index };
      meshes.push(pinMesh);
    }
  }

  return { group, meshes };
}

export const esp32Model: ModelDefinition = {
  kind: 'esp32',
  build: buildEsp32,
  resolvePinPosition: resolveEsp32PinPosition,
  hidePinMarkers: true,
};
