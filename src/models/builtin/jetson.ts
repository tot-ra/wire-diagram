import { resolvePhysicalPinNumber } from '../../pinouts.js';
import type { Component, Pin, Vec3 } from '../../types.js';
import { addMesh } from '../helpers.js';
import {
  addPinHeader,
  createHeaderLook,
  HEADER_PITCH_MM,
  headerColumnOffset,
  headerPinTipY,
  headerRowOffset,
} from '../parts/pin-header.js';
import {
  addMicroUsb,
  addUsbA,
  addUsbC,
  MICRO_USB_MM,
  USB_A_STACKED_MM,
  USB_C_MM,
} from '../parts/usb.js';
import type { ModelDefinition, PinLayoutContext, ThreeModule } from '../types.js';

/** Illustrative Jetson Nano developer carrier (B01-style). Not verified CAD. */
export const JETSON_NANO_W_MM = 100;
export const JETSON_NANO_D_MM = 80;
/** Illustrative Jetson Orin Nano developer carrier. Not verified CAD. */
export const JETSON_ORIN_W_MM = 100;
export const JETSON_ORIN_D_MM = 79;
export const JETSON_PCB_MM = 1.6;

const GPIO_COLUMNS = 20;
const RJ45_MM = { depth: 21.2, width: 16, height: 13.5 } as const;
const HDMI_MM = { depth: 14.5, width: 12.5, height: 5.2 } as const;
const DP_MM = { depth: 10.5, width: 8.8, height: 4.8 } as const;
const BARREL_MM = { depth: 12, radius: 5.5 } as const;
const USB_STACK_GAP_MM = 2.4;

function pcbTopY(): number {
  return JETSON_PCB_MM / 2;
}

function portY(height: number): number {
  return pcbTopY() + height / 2 - 0.15;
}

export function jetsonHeaderCenter(component: Component): Vec3 {
  const [w, , d] = component.dimensions;
  const z = d / 2 - HEADER_PITCH_MM;
  return [-w * 0.02, 0, z];
}

export function jetsonPinTipY(): number {
  return headerPinTipY(pcbTopY(), 'male');
}

function headerPinXZ(center: Vec3, pinNumber: number): { x: number; z: number } {
  const clamped = Math.max(1, Math.min(40, pinNumber));
  const column = Math.floor((clamped - 1) / 2);
  const row = clamped % 2 === 1 ? 1 : 0;
  return {
    x: center[0] + headerColumnOffset(column, GPIO_COLUMNS),
    z: center[2] + headerRowOffset(row, 2),
  };
}

function pinUserData(row: number, column: number): Record<string, unknown> {
  const pinNumber = column * 2 + (row === 1 ? 1 : 2);
  return { kind: 'jetson-gpio-pin', row, column, pinNumber };
}

function addPcb(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  w: number,
  d: number,
  color: string,
  name: string,
): void {
  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, JETSON_PCB_MM, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.12 }),
  );
  pcb.name = name;
  meshes.push(pcb);
}

function addGpioHeader(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  component: Component,
  namePrefix: string,
  housingName: string,
): void {
  const look = createHeaderLook(THREE);
  addPinHeader(THREE, group, meshes, {
    columns: GPIO_COLUMNS,
    rows: 2,
    contact: 'male',
    pcbTopY: pcbTopY(),
    center: jetsonHeaderCenter(component),
    look,
    namePrefix,
    housingName,
    pinUserData,
  });
}

function addHeatsink(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  x: number,
  z: number,
  size: number,
  name: string,
): void {
  const top = pcbTopY();
  const base = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(size, 2.2, size),
    new THREE.MeshStandardMaterial({ color: '#8a9098', roughness: 0.42, metalness: 0.55 }),
    [x, top + 1.1, z],
  );
  base.name = `${name}-base`;
  meshes.push(base);
  const finCount = 5;
  for (let i = 0; i < finCount; i += 1) {
    const offset = -size / 2 + (i + 0.5) * (size / finCount);
    const fin = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(size * 0.82, 8.5, 0.75),
      new THREE.MeshStandardMaterial({ color: '#a8b0b8', roughness: 0.38, metalness: 0.62 }),
      [x, top + 5.8, z + offset],
    );
    fin.name = `${name}-fin:${i}`;
    meshes.push(fin);
  }
}

function addFan(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  x: number,
  z: number,
  size: number,
  name: string,
): void {
  const top = pcbTopY();
  const housingH = 6.8;
  const housing = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(size, housingH, size),
    new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.62, metalness: 0.1 }),
    [x, top + housingH / 2, z],
  );
  housing.name = `${name}-housing`;
  meshes.push(housing);
  const bladeY = top + housingH + 1.4;
  const hub = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(size * 0.12, size * 0.12, 1.0, 16),
    new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.5, metalness: 0.2 }),
    [x, bladeY, z],
  );
  hub.name = `${name}-hub`;
  meshes.push(hub);
  const bladeMat = new THREE.MeshStandardMaterial({ color: '#6a7580', roughness: 0.48, metalness: 0.22 });
  for (let i = 0; i < 4; i += 1) {
    const blade = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(size * 0.36, 0.42, size * 0.11),
      bladeMat,
      [x + (i % 2 === 0 ? size * 0.17 : -size * 0.17), bladeY, z + (i < 2 ? size * 0.17 : -size * 0.17)],
    );
    blade.name = `${name}-blade:${i}`;
    meshes.push(blade);
  }
  const grilleY = bladeY + 1.35;
  const grilleMat = new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.68, metalness: 0.12 });
  for (const [i, rotZ] of [[0, 0], [1, Math.PI / 2]] as const) {
    const bar = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(size * 0.78, 0.28, size * 0.07),
      grilleMat,
      [x, grilleY, z],
      [0, 0, rotZ],
    );
    bar.name = `${name}-grille:${i}`;
    meshes.push(bar);
  }
}

function jetsonUsbStackZ(d: number, stackIndex: 0 | 1): number {
  const stack0Z = d * 0.2;
  if (stackIndex === 0) return stack0Z;
  return stack0Z - USB_A_STACKED_MM.width - USB_STACK_GAP_MM;
}

function stackedUsbPortY(portIndex: 0 | 1): number {
  const baseY = portY(USB_A_STACKED_MM.height);
  const yOff = portIndex === 0 ? -USB_A_STACKED_MM.height * 0.22 : USB_A_STACKED_MM.height * 0.22;
  return baseY + yOff;
}

function stackedUsbAnchor(w: number, stackZ: number, portIndex: 0 | 1): Vec3 {
  const usbX = w / 2 - USB_A_STACKED_MM.depth / 2 + 1.4;
  return [usbX, stackedUsbPortY(portIndex), stackZ];
}

function addHdmi(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  position: Vec3,
  metal: import('three').Material,
  cavity: import('three').Material,
  name: string,
): void {
  const { depth, width, height } = HDMI_MM;
  const shell = addMesh(THREE, group, new THREE.BoxGeometry(depth, height, width), metal, position);
  shell.name = name;
  meshes.push(shell);
  const cavityMesh = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(depth * 0.5, height * 0.55, width * 0.62),
    cavity,
    [position[0] - depth / 2 + depth * 0.28, position[1], position[2]],
  );
  cavityMesh.name = `${name}:cavity`;
  meshes.push(cavityMesh);
}

function addDisplayPort(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  position: Vec3,
  metal: import('three').Material,
  cavity: import('three').Material,
  name: string,
): void {
  const { depth, width, height } = DP_MM;
  const shell = addMesh(THREE, group, new THREE.BoxGeometry(depth, height, width), metal, position);
  shell.name = name;
  meshes.push(shell);
  const cavityMesh = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(depth * 0.48, height * 0.5, width * 0.55),
    cavity,
    [position[0] - depth / 2 + depth * 0.26, position[1], position[2]],
  );
  cavityMesh.name = `${name}:cavity`;
  meshes.push(cavityMesh);
}

function addBarrelJack(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  position: Vec3,
  plastic: import('three').Material,
  metal: import('three').Material,
  name: string,
): void {
  const alongX: Vec3 = [0, 0, Math.PI / 2];
  const body = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(BARREL_MM.radius, BARREL_MM.radius, BARREL_MM.depth * 0.72, 20),
    plastic,
    position,
    alongX,
  );
  body.name = name;
  meshes.push(body);
  const sleeve = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(BARREL_MM.radius * 0.82, BARREL_MM.radius * 0.82, BARREL_MM.depth * 0.22, 20),
    metal,
    [position[0] - BARREL_MM.depth * 0.34, position[1], position[2]],
    alongX,
  );
  sleeve.name = `${name}-sleeve`;
  meshes.push(sleeve);
}

function addRj45(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  position: Vec3,
  metal: import('three').Material,
  plastic: import('three').Material,
  name: string,
): void {
  const { depth, width, height } = RJ45_MM;
  const shell = addMesh(THREE, group, new THREE.BoxGeometry(depth, height, width), metal, position);
  shell.name = name;
  meshes.push(shell);
  const cavity = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(depth * 0.42, height * 0.62, width * 0.7),
    plastic,
    [position[0] + depth / 2 - depth * 0.24, position[1] - height * 0.04, position[2]],
  );
  cavity.name = `${name}:cavity`;
  meshes.push(cavity);
}

function addM2Outline(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  x: number,
  z: number,
  name: string,
): void {
  const top = pcbTopY();
  const slot = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(22, 1.1, 16.5),
    new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.58, metalness: 0.12 }),
    [x, top + 0.55, z],
  );
  slot.name = name;
  meshes.push(slot);
}

function addCameraFpc(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  x: number,
  z: number,
  name: string,
): void {
  const top = pcbTopY();
  const fpc = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(20, 2.2, 4.2),
    new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.62, metalness: 0.1 }),
    [x, top + 1.1, z],
  );
  fpc.name = name;
  meshes.push(fpc);
}

/** Jetson Nano carrier: barrel power, micro-USB, HDMI, four USB-A, heatsink. */
export function buildJetsonNano(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, , d] = component.dimensions;
  const metal = new THREE.MeshStandardMaterial({ color: '#b7bec6', roughness: 0.34, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.62, metalness: 0.12 });
  const cavity = new THREE.MeshStandardMaterial({ color: '#14161a', roughness: 0.72, metalness: 0.12 });

  addPcb(THREE, group, meshes, w, d, '#3d6f8a', 'jetson-nano-pcb');
  addGpioHeader(THREE, group, meshes, component, 'jetson-nano-gpio', 'jetson-nano-gpio');
  addHeatsink(THREE, group, meshes, w * 0.12, -d * 0.08, 34, 'jetson-nano-heatsink');
  addM2Outline(THREE, group, meshes, -w * 0.28, -d * 0.22, 'jetson-nano-m2');
  addCameraFpc(THREE, group, meshes, w * 0.3, -d / 2 + 4, 'jetson-nano-camera');

  addBarrelJack(
    THREE,
    group,
    meshes,
    [-w / 2 + BARREL_MM.depth / 2 - 1.5, pcbTopY() + BARREL_MM.radius - 0.4, d * 0.28],
    dark,
    metal,
    'jetson-nano-power',
  );
  addMicroUsb(THREE, group, meshes, {
    position: [-w / 2 + MICRO_USB_MM.depth / 2 - 1.2, portY(MICRO_USB_MM.height), d * 0.08],
    facing: '-x',
    namePrefix: 'jetson-nano-micro-usb',
  });
  addHdmi(
    THREE,
    group,
    meshes,
    [-w / 2 + HDMI_MM.depth / 2 - 1.4, portY(HDMI_MM.height), -d * 0.22],
    metal,
    cavity,
    'jetson-nano-hdmi',
  );

  const usbX = w / 2 - USB_A_STACKED_MM.depth / 2 + 1.4;
  const usbY = portY(USB_A_STACKED_MM.height);
  for (const [stackIndex, namePrefix] of [[0, 'jetson-nano-usb:0'], [1, 'jetson-nano-usb:2']] as const) {
    addUsbA(THREE, group, meshes, {
      position: [usbX, usbY, jetsonUsbStackZ(d, stackIndex)],
      facing: '+x',
      stacked: true,
      generation: 3,
      namePrefix,
    });
  }

  addRj45(
    THREE,
    group,
    meshes,
    [w / 2 - RJ45_MM.depth / 2 + 1.5, portY(RJ45_MM.height), d * 0.3],
    metal,
    dark,
    'jetson-nano-eth',
  );

  const module = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(69, 1.2, 45),
    new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.48, metalness: 0.18 }),
    [w * 0.1, pcbTopY() + 0.6, -d * 0.06],
  );
  module.name = 'jetson-nano-module';
  meshes.push(module);

  return { group, meshes };
}

/** Jetson Orin Nano carrier: DC barrel power, USB-C data/recovery, DisplayPort, fan, four USB-A. */
export function buildJetsonOrinNano(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, , d] = component.dimensions;
  const metal = new THREE.MeshStandardMaterial({ color: '#b7bec6', roughness: 0.34, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.62, metalness: 0.12 });
  const cavity = new THREE.MeshStandardMaterial({ color: '#14161a', roughness: 0.72, metalness: 0.12 });

  addPcb(THREE, group, meshes, w, d, '#1f2429', 'jetson-orin-nano-pcb');
  addGpioHeader(THREE, group, meshes, component, 'jetson-orin-nano-gpio', 'jetson-orin-nano-gpio');
  addFan(THREE, group, meshes, w * 0.1, -d * 0.06, 36, 'jetson-orin-nano-fan');
  addM2Outline(THREE, group, meshes, -w * 0.26, -d * 0.2, 'jetson-orin-nano-m2');
  addCameraFpc(THREE, group, meshes, w * 0.28, -d / 2 + 4, 'jetson-orin-nano-camera');

  addBarrelJack(
    THREE,
    group,
    meshes,
    [-w / 2 + BARREL_MM.depth / 2 - 1.5, pcbTopY() + BARREL_MM.radius - 0.4, d * 0.28],
    dark,
    metal,
    'jetson-orin-nano-power',
  );
  addUsbC(THREE, group, meshes, {
    position: [-w / 2 + USB_C_MM.depth / 2 - 1.2, portY(USB_C_MM.height), d * 0.08],
    facing: '-x',
    namePrefix: 'jetson-orin-nano-usbc',
  });
  addDisplayPort(
    THREE,
    group,
    meshes,
    [-w / 2 + DP_MM.depth / 2 - 1.3, portY(DP_MM.height), -d * 0.18],
    metal,
    cavity,
    'jetson-orin-nano-dp',
  );

  const usbX = w / 2 - USB_A_STACKED_MM.depth / 2 + 1.4;
  const usbY = portY(USB_A_STACKED_MM.height);
  for (const [stackIndex, namePrefix] of [[0, 'jetson-orin-nano-usb:0'], [1, 'jetson-orin-nano-usb:2']] as const) {
    addUsbA(THREE, group, meshes, {
      position: [usbX, usbY, jetsonUsbStackZ(d, stackIndex)],
      facing: '+x',
      stacked: true,
      generation: 3,
      namePrefix,
    });
  }

  addRj45(
    THREE,
    group,
    meshes,
    [w / 2 - RJ45_MM.depth / 2 + 1.5, portY(RJ45_MM.height), d * 0.28],
    metal,
    dark,
    'jetson-orin-nano-eth',
  );

  const module = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(70, 1.2, 45),
    new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.48, metalness: 0.18 }),
    [w * 0.08, pcbTopY() + 0.6, -d * 0.05],
  );
  module.name = 'jetson-orin-nano-module';
  meshes.push(module);

  return { group, meshes };
}

function normalizePortKey(id: string): string {
  return id.trim().toUpperCase().replace(/[\s_\-]+/g, '');
}

function nanoPortLocal(component: Component, key: string): Vec3 | undefined {
  const [w, , d] = component.dimensions;
  if (key === 'POWER' || key === 'DC' || key === 'BARREL' || key === 'VIN') {
    return [-w / 2, pcbTopY() + BARREL_MM.radius - 0.4, d * 0.28];
  }
  if (key === 'MICROUSB' || key === 'USB' || key === 'OTG') {
    return [-w / 2, portY(MICRO_USB_MM.height), d * 0.08];
  }
  if (key === 'HDMI') return [-w / 2, portY(HDMI_MM.height), -d * 0.22];
  if (key === 'ETH' || key === 'RJ45' || key === 'LAN' || key === 'ETHERNET') {
    return [w / 2, portY(RJ45_MM.height), d * 0.3];
  }
  const stack0Z = jetsonUsbStackZ(d, 0);
  const stack1Z = jetsonUsbStackZ(d, 1);
  if (key === 'USB0') return stackedUsbAnchor(w, stack0Z, 0);
  if (key === 'USB1') return stackedUsbAnchor(w, stack0Z, 1);
  if (key === 'USB2') return stackedUsbAnchor(w, stack1Z, 0);
  if (key === 'USB3') return stackedUsbAnchor(w, stack1Z, 1);
  return undefined;
}

function orinPortLocal(component: Component, key: string): Vec3 | undefined {
  const [w, , d] = component.dimensions;
  if (key === 'POWER' || key === 'DC' || key === 'BARREL' || key === 'VIN') {
    return [-w / 2, pcbTopY() + BARREL_MM.radius - 0.4, d * 0.28];
  }
  if (key === 'USBC' || key === 'OTG') {
    return [-w / 2, portY(USB_C_MM.height), d * 0.08];
  }
  if (key === 'DP' || key === 'DISPLAYPORT' || key === 'DISPLAY') {
    return [-w / 2, portY(DP_MM.height), -d * 0.18];
  }
  if (key === 'ETH' || key === 'RJ45' || key === 'LAN' || key === 'ETHERNET') {
    return [w / 2, portY(RJ45_MM.height), d * 0.28];
  }
  const stack0Z = jetsonUsbStackZ(d, 0);
  const stack1Z = jetsonUsbStackZ(d, 1);
  if (key === 'USB0') return stackedUsbAnchor(w, stack0Z, 0);
  if (key === 'USB1') return stackedUsbAnchor(w, stack0Z, 1);
  if (key === 'USB2') return stackedUsbAnchor(w, stack1Z, 0);
  if (key === 'USB3') return stackedUsbAnchor(w, stack1Z, 1);
  return undefined;
}

export function resolveJetsonPinPosition(
  component: Component,
  pin: Pin,
  context: PinLayoutContext,
): Vec3 {
  const key = normalizePortKey(pin.id);
  const tipY = jetsonPinTipY();
  const center = jetsonHeaderCenter(component);

  if (key === 'GPIO' || key === 'HEADER' || key === 'HAT') {
    return [center[0], tipY, center[2]];
  }

  const physical = resolvePhysicalPinNumber(component, pin);
  if (physical !== undefined) {
    const at = headerPinXZ(center, physical);
    return [at.x, tipY, at.z];
  }

  const port =
    component.kind === 'jetson-orin-nano'
      ? orinPortLocal(component, key)
      : nanoPortLocal(component, key);
  if (port) return port;

  const column = Math.max(0, Math.min(GPIO_COLUMNS - 1, context.index));
  const at = headerPinXZ(center, column * 2 + 1);
  return [at.x, tipY, at.z];
}

export const jetsonNanoModel: ModelDefinition = {
  kind: 'jetson-nano',
  build: buildJetsonNano,
  resolvePinPosition: resolveJetsonPinPosition,
  hidePinMarkers: true,
};

export const jetsonOrinNanoModel: ModelDefinition = {
  kind: 'jetson-orin-nano',
  build: buildJetsonOrinNano,
  resolvePinPosition: resolveJetsonPinPosition,
  hidePinMarkers: true,
};
