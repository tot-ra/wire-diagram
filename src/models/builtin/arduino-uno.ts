import type { Component, Pin, Vec3 } from '../../types.js';
import { addMesh } from '../helpers.js';
import {
  addPinHeader,
  createHeaderLook,
  HEADER_PITCH_MM,
  headerPinTipY,
} from '../parts/pin-header.js';
import { addUsbB, USB_B_MM } from '../parts/usb.js';
import type { ModelDefinition, PinLayoutContext, ThreeModule } from '../types.js';

/** Arduino UNO R3 PCB from the published 2.7 in x 2.1 in outline. */
export const ARDUINO_UNO_PCB_MM = 1.6;
export const ARDUINO_UNO_NOMINAL_W_MM = 68.58;
export const ARDUINO_UNO_NOMINAL_D_MM = 53.34;
/** Female header towers. Shorter than DevKit males so the DIP MCU stays readable. */
export const ARDUINO_UNO_HEADER_HEIGHT_MM = 8.4;
export const ARDUINO_UNO_DIGITAL_SLOTS = 18;
export const ARDUINO_UNO_POWER_SLOTS = 14;

/** 100-mil grid from the UNO R3 dimensional drawing, origin at the USB-left / analog-bottom corner. */
const EDGE_INSET_MM = HEADER_PITCH_MM;
const DIGITAL_8_FIRST_X_MM = 17.78;
const DIGITAL_10_FIRST_X_MM = 44.45;
const HOLE_R_MM = 1.6;
const HOLES_FROM_CORNER_MM: ReadonlyArray<readonly [number, number]> = [
  [13.97, 2.54],
  [15.24, 50.8],
  [66.04, 7.62],
  [66.04, 35.56],
];

type HeaderBank = 'digital' | 'power';

interface HeaderSlot {
  bank: HeaderBank;
  index: number;
}

function scaleX(widthMm: number): number {
  return widthMm / ARDUINO_UNO_NOMINAL_W_MM;
}

function scaleZ(depthMm: number): number {
  return depthMm / ARDUINO_UNO_NOMINAL_D_MM;
}

function fromCorner(widthMm: number, depthMm: number, x: number, z: number): { x: number; z: number } {
  return {
    x: -widthMm / 2 + x * scaleX(widthMm),
    z: -depthMm / 2 + z * scaleZ(depthMm),
  };
}

function digitalRowZ(depthMm: number): number {
  return depthMm / 2 - EDGE_INSET_MM / 2;
}

function powerRowZ(depthMm: number): number {
  return -depthMm / 2 + EDGE_INSET_MM / 2;
}

function blockFirstX(widthMm: number, firstFromLeftMm: number): number {
  return fromCorner(widthMm, ARDUINO_UNO_NOMINAL_D_MM, firstFromLeftMm, 0).x;
}

export function arduinoUnoDigitalPinX(widthMm: number, index: number): number {
  const clamped = Math.max(0, Math.min(ARDUINO_UNO_DIGITAL_SLOTS - 1, index));
  if (clamped < 8) return blockFirstX(widthMm, DIGITAL_8_FIRST_X_MM) + clamped * HEADER_PITCH_MM;
  return blockFirstX(widthMm, DIGITAL_10_FIRST_X_MM) + (clamped - 8) * HEADER_PITCH_MM;
}

export function arduinoUnoPowerPinX(widthMm: number, index: number): number {
  const clamped = Math.max(0, Math.min(ARDUINO_UNO_POWER_SLOTS - 1, index));
  if (clamped < 8) return blockFirstX(widthMm, DIGITAL_8_FIRST_X_MM) + clamped * HEADER_PITCH_MM;
  return blockFirstX(widthMm, DIGITAL_10_FIRST_X_MM) + (clamped - 8) * HEADER_PITCH_MM;
}

export function arduinoUnoHeaderRowZ(depthMm: number, bank: HeaderBank): number {
  return bank === 'digital' ? digitalRowZ(depthMm) : powerRowZ(depthMm);
}

export function arduinoUnoPinTipY(): number {
  return headerPinTipY(ARDUINO_UNO_PCB_MM / 2, 'female', ARDUINO_UNO_HEADER_HEIGHT_MM);
}

function normalizePinId(id: string): string {
  return id.trim().toUpperCase().replace(/[\s_]+/g, '');
}

/** Digital female sockets, USB-left to ICSP-right, including the R3 SDA/SCL pair. */
function digitalSlotIndex(id: string): number | undefined {
  const key = normalizePinId(id);
  const numbered = key.match(/^(?:D|DPIN|PIN)?(\d{1,2})$/);
  if (numbered) {
    const n = Number(numbered[1]);
    if (n >= 0 && n <= 13) return n;
  }
  const aliases: Record<string, number> = {
    RX: 0,
    RXD: 0,
    RX0: 0,
    TX: 1,
    TXD: 1,
    TX0: 1,
    SS: 10,
    MOSI: 11,
    MISO: 12,
    SCK: 13,
    LED: 13,
    LEDBUILTIN: 13,
    L: 13,
    GND: 14,
    AREF: 15,
    SDA: 16,
    SCL: 17,
  };
  return aliases[key];
}

/** Power 8-pin plus analog 6-pin on the -Z edge. */
function powerSlotIndex(id: string): number | undefined {
  const key = normalizePinId(id);
  const analog = key.match(/^A(\d)$/);
  if (analog) {
    const n = Number(analog[1]);
    if (n >= 0 && n <= 5) return 8 + n;
  }
  const aliases: Record<string, number> = {
    NC: 0,
    NCON: 0,
    IOREF: 1,
    RESET: 2,
    RST: 2,
    '3V3': 3,
    '3.3V': 3,
    '3V': 3,
    '5V': 4,
    VCC: 4,
    VDD: 4,
    GND: 5,
    GND1: 5,
    GND2: 6,
    VIN: 7,
    VM: 7,
  };
  return aliases[key];
}

function namedSlot(pin: Pin): HeaderSlot | undefined {
  const id = pin.id;
  if (pin.side === 'left') {
    const digital = digitalSlotIndex(id);
    if (digital !== undefined) return { bank: 'digital', index: digital };
    const power = powerSlotIndex(id);
    if (power !== undefined) return { bank: 'power', index: power };
    return undefined;
  }
  const power = powerSlotIndex(id);
  if (power !== undefined) return { bank: 'power', index: power };
  const digital = digitalSlotIndex(id);
  if (digital !== undefined) return { bank: 'digital', index: digital };
  return undefined;
}

function fallbackSlot(pin: Pin, context: PinLayoutContext): HeaderSlot {
  if (pin.side === 'left') {
    return { bank: 'digital', index: Math.max(0, Math.min(ARDUINO_UNO_DIGITAL_SLOTS - 1, context.index)) };
  }
  return { bank: 'power', index: Math.max(0, Math.min(ARDUINO_UNO_POWER_SLOTS - 1, context.index)) };
}

export function resolveArduinoUnoPinPosition(
  component: Component,
  pin: Pin,
  context: PinLayoutContext,
): Vec3 {
  const [w, , d] = component.dimensions;
  const slot = namedSlot(pin) ?? fallbackSlot(pin, context);
  const x =
    slot.bank === 'digital' ? arduinoUnoDigitalPinX(w, slot.index) : arduinoUnoPowerPinX(w, slot.index);
  return [x, arduinoUnoPinTipY(), arduinoUnoHeaderRowZ(d, slot.bank)];
}

function portY(height: number): number {
  return ARDUINO_UNO_PCB_MM / 2 + height / 2 - 0.15;
}

function addHole(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  x: number,
  z: number,
  name: string,
): void {
  // WHY: a disk coplanar with the soldermask z-fights; a cylinder slightly taller than the PCB reads as a hole.
  const hole = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(HOLE_R_MM, HOLE_R_MM, ARDUINO_UNO_PCB_MM + 0.35, 18),
    new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.85, metalness: 0.04 }),
    [x, 0, z],
  );
  hole.name = name;
  meshes.push(hole);
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
    new THREE.BoxGeometry(1.6, 0.7, 0.9),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.08, emissive: color, emissiveIntensity: 0.22 }),
    position,
  );
  led.name = name;
  meshes.push(led);
}

function addHeaderBlock(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  look: ReturnType<typeof createHeaderLook>,
  options: {
    columns: number;
    firstX: number;
    z: number;
    name: string;
    pinBottomY: number;
    pinIdAt: (column: number) => string;
  },
): void {
  const mid = options.firstX + ((options.columns - 1) * HEADER_PITCH_MM) / 2;
  addPinHeader(THREE, group, meshes, {
    columns: options.columns,
    rows: 1,
    contact: 'female',
    heightMm: ARDUINO_UNO_HEADER_HEIGHT_MM,
    pcbTopY: ARDUINO_UNO_PCB_MM / 2,
    center: [mid, 0, options.z],
    look,
    pinBottomY: options.pinBottomY,
    namePrefix: options.name,
    housingName: options.name,
    pinName: (_row, column) => `${options.name}-pin:${options.pinIdAt(column)}`,
    pinUserData: (_row, column) => ({
      kind: 'arduino-uno-header-pin',
      pinId: options.pinIdAt(column),
      column,
    }),
  });
}

/**
 * Arduino UNO R3 development board: teal PCB, USB-B, DC jack, DIP ATmega328P,
 * female digital/power headers, and the usual power/status LEDs.
 */
export function buildArduinoUno(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, , d] = component.dimensions;
  const pcbTop = ARDUINO_UNO_PCB_MM / 2;
  const pinBottomY = -pcbTop - 1.1;
  const look = createHeaderLook(THREE);
  const plastic = new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.62, metalness: 0.12 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c5ccd3', roughness: 0.32, metalness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d7c089', roughness: 0.32, metalness: 0.42 });
  const chip = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.48, metalness: 0.18 });

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, ARDUINO_UNO_PCB_MM, d),
    new THREE.MeshStandardMaterial({ color: '#0a6e74', roughness: 0.58, metalness: 0.08 }),
  );
  pcb.name = 'arduino-uno-pcb';
  meshes.push(pcb);

  HOLES_FROM_CORNER_MM.forEach(([hx, hz], index) => {
    const at = fromCorner(w, d, hx, hz);
    addHole(THREE, group, meshes, at.x, at.z, `arduino-uno-hole:${index}`);
  });

  const usbZ = fromCorner(w, d, 0, 40.5).z;
  addUsbB(THREE, group, meshes, {
    position: [-w / 2 + USB_B_MM.depth / 2 - 1.6, portY(USB_B_MM.height), usbZ],
    facing: '-x',
    namePrefix: 'arduino-uno-usb',
  });

  const jackLen = 14.2;
  const jackR = 4.6;
  const jackZ = fromCorner(w, d, 0, 13.2).z;
  const jackX = -w / 2 + jackLen / 2 - 1.8;
  const jackY = pcbTop + jackR - 0.35;
  const alongX: Vec3 = [0, 0, Math.PI / 2];
  const jackShell = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(jackR, jackR, jackLen * 0.72, 22),
    plastic,
    [jackX + 1.2, jackY, jackZ],
    alongX,
  );
  jackShell.name = 'arduino-uno-jack';
  meshes.push(jackShell);
  const jackSleeve = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(jackR * 0.78, jackR * 0.78, jackLen * 0.28, 22),
    metal,
    [jackX - jackLen * 0.28, jackY, jackZ],
    alongX,
  );
  jackSleeve.name = 'arduino-uno-jack-sleeve';
  meshes.push(jackSleeve);
  const jackPin = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(0.85, 0.85, jackLen * 0.4, 12),
    gold,
    [jackX - 0.6, jackY, jackZ],
    alongX,
  );
  jackPin.name = 'arduino-uno-jack-pin';
  meshes.push(jackPin);

  const digitalZ = digitalRowZ(d);
  const powerZ = powerRowZ(d);
  const digital8X = blockFirstX(w, DIGITAL_8_FIRST_X_MM);
  const digital10X = blockFirstX(w, DIGITAL_10_FIRST_X_MM);

  addHeaderBlock(THREE, group, meshes, look, {
    columns: 8,
    firstX: digital8X,
    z: digitalZ,
    name: 'arduino-uno-digital-lo',
    pinBottomY,
    pinIdAt: (column) => `D${column}`,
  });
  addHeaderBlock(THREE, group, meshes, look, {
    columns: 10,
    firstX: digital10X,
    z: digitalZ,
    name: 'arduino-uno-digital-hi',
    pinBottomY,
    pinIdAt: (column) => ['D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'GND', 'AREF', 'SDA', 'SCL'][column]!,
  });
  addHeaderBlock(THREE, group, meshes, look, {
    columns: 8,
    firstX: digital8X,
    z: powerZ,
    name: 'arduino-uno-power',
    pinBottomY,
    pinIdAt: (column) => ['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GND2', 'VIN'][column]!,
  });
  addHeaderBlock(THREE, group, meshes, look, {
    columns: 6,
    firstX: digital10X,
    z: powerZ,
    name: 'arduino-uno-analog',
    pinBottomY,
    pinIdAt: (column) => `A${column}`,
  });

  const mcuX = w * 0.1;
  const mcuZ = d * 0.04;
  const socket = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(37.2, 4.2, 10.2),
    plastic,
    [mcuX, pcbTop + 2.1, mcuZ],
  );
  socket.name = 'arduino-uno-socket';
  meshes.push(socket);
  const mcu = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(34.6, 3.4, 7.6),
    chip,
    [mcuX, pcbTop + 4.2 + 1.5, mcuZ],
  );
  mcu.name = 'arduino-uno-mcu';
  meshes.push(mcu);
  const notch = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(1.15, 1.15, 3.6, 14),
    new THREE.MeshStandardMaterial({ color: '#2a2d32', roughness: 0.5, metalness: 0.12 }),
    [mcuX - 16.4, pcbTop + 5.7, mcuZ],
  );
  notch.name = 'arduino-uno-mcu-notch';
  meshes.push(notch);
  for (let i = 0; i < 14; i += 1) {
    const px = mcuX - 6.5 * HEADER_PITCH_MM + i * HEADER_PITCH_MM;
    for (const side of [-1, 1] as const) {
      const pin = addMesh(
        THREE,
        group,
        new THREE.BoxGeometry(0.55, 3.2, 0.55),
        gold,
        [px, pcbTop + 1.5, mcuZ + side * 4.7],
      );
      pin.name = `arduino-uno-mcu-pin:${side < 0 ? 'neg' : 'pos'}:${i}`;
      meshes.push(pin);
    }
  }

  addPinHeader(THREE, group, meshes, {
    columns: 3,
    rows: 2,
    contact: 'male',
    heightMm: 5.8,
    pcbTopY: pcbTop,
    center: [w * 0.36, 0, digitalZ - HEADER_PITCH_MM * 2.15],
    along: 'x',
    look,
    pinBottomY,
    namePrefix: 'arduino-uno-icsp',
    housingName: 'arduino-uno-icsp',
  });

  const usbMcu = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(7.2, 1.15, 7.2),
    chip,
    [-w * 0.26, pcbTop + 0.58, d * 0.14],
  );
  usbMcu.name = 'arduino-uno-16u2';
  meshes.push(usbMcu);

  addPinHeader(THREE, group, meshes, {
    columns: 3,
    rows: 2,
    contact: 'male',
    heightMm: 5.2,
    pcbTopY: pcbTop,
    center: [-w * 0.18, 0, d * 0.28],
    along: 'x',
    look,
    pinBottomY,
    namePrefix: 'arduino-uno-icsp-usb',
    housingName: 'arduino-uno-icsp-usb',
  });

  const crystal = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(11.5, 3.6, 4.7),
    metal,
    [w * 0.02, pcbTop + 1.8, -d * 0.12],
  );
  crystal.name = 'arduino-uno-crystal';
  meshes.push(crystal);

  const reset = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(6.2, 4.2, 6.2),
    plastic,
    [-w * 0.2, pcbTop + 2.1, d * 0.3],
  );
  reset.name = 'arduino-uno-reset';
  meshes.push(reset);
  const resetCap = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(1.7, 1.7, 1.4, 16),
    new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.55, metalness: 0.08 }),
    [-w * 0.2, pcbTop + 4.8, d * 0.3],
  );
  resetCap.name = 'arduino-uno-reset-cap';
  meshes.push(resetCap);

  const regulator = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(6.6, 2.2, 6.6),
    chip,
    [-w * 0.22, pcbTop + 1.1, -d * 0.16],
  );
  regulator.name = 'arduino-uno-regulator';
  meshes.push(regulator);

  const capMat = new THREE.MeshStandardMaterial({ color: '#1c3f8c', roughness: 0.48, metalness: 0.18 });
  for (const [i, cz] of [-0.22, -0.08].entries()) {
    const cap = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(2.4, 2.4, 6.4, 16),
      capMat,
      [-w * 0.08 + i * 6.2, pcbTop + 3.2, d * cz],
    );
    cap.name = `arduino-uno-cap:${i}`;
    meshes.push(cap);
  }

  addLed(THREE, group, meshes, [arduinoUnoDigitalPinX(w, 13) - 3.2, pcbTop + 0.45, digitalZ - 4.2], '#e2b03a', 'arduino-uno-led-l');
  addLed(THREE, group, meshes, [-w * 0.12, pcbTop + 0.45, powerZ + 5.5], '#3dcc6a', 'arduino-uno-led-on');
  addLed(THREE, group, meshes, [-w * 0.3, pcbTop + 0.45, d * 0.08], '#d94a3a', 'arduino-uno-led-tx');
  addLed(THREE, group, meshes, [-w * 0.3, pcbTop + 0.45, d * 0.02], '#d94a3a', 'arduino-uno-led-rx');

  return { group, meshes };
}

export const arduinoUnoModel: ModelDefinition = {
  kind: 'arduino-uno',
  build: buildArduinoUno,
  resolvePinPosition: resolveArduinoUnoPinPosition,
  hidePinMarkers: true,
};
