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
  USB_A_STACKED_MM,
  USB_C_MM,
  MICRO_USB_MM,
} from '../parts/usb.js';
import type { ModelDefinition, PinLayoutContext, ThreeModule } from '../types.js';

export type RaspberryPiVariant = '4' | '5' | 'zero' | 'pico';

/** Official Pi 4 Model B PCB (datasheet mechanical drawing, origin at USB-C/HDMI + audio corner). */
export const PI4_NOMINAL_W_MM = 85;
export const PI4_NOMINAL_D_MM = 56;
export const PI4_PCB_MM = 1.5;
const PI4_HOLE_R_MM = 1.35;
const PI4_HOLE_SPACING_X_MM = 58;
const PI4_HOLE_SPACING_Z_MM = 49;
const PI4_EDGE_INSET_MM = 3.5;
/** GPIO header centre X: midpoint between the 58 mm hole pair (3.5 + 29). */
const PI4_GPIO_CENTER_X_MM = PI4_EDGE_INSET_MM + PI4_HOLE_SPACING_X_MM / 2;
const PI4_SOC_X_MM = PI4_EDGE_INSET_MM + 25.75;
const PI4_SOC_Z_MM = 32.5;
const PI4_SOC_MM = 15;
/** USB-C centre along the 56 mm edge: 7.7 mm past the GPIO-side hole. */
const PI4_USBC_Z_MM = PI4_NOMINAL_D_MM - PI4_EDGE_INSET_MM - 7.7;
/** Chained left-edge pitches from the drawing: USB-C, HDMI0, HDMI1. */
const PI4_HDMI0_Z_MM = PI4_USBC_Z_MM - 14.8;
const PI4_HDMI1_Z_MM = PI4_HDMI0_Z_MM - 13.5;
const PI4_AUDIO_Z_MM = 7.5;
const PI4_ETH_Z_MM = 45.75;
const PI4_USB3_Z_MM = 27;
const PI4_USB2_Z_MM = 9;
const PI4_USB_ETH_OVERHANG_MM = 3;
const PI4_POE_OFFSET_Z_MM = 6.14;
const MICRO_HDMI_MM = { depth: 8.1, width: 7.1, height: 3.5 } as const;
const RJ45_MM = { depth: 21.2, width: 16, height: 13.5 } as const;
const AUDIO_JACK_MM = { depth: 14.9, radius: 3.0 } as const;

/** YAML properties.variant selects the silhouette. Unknown values fall back to Pi 4. */
export function raspberryPiVariant(component: Component): RaspberryPiVariant {
  const raw = String(component.properties?.variant ?? '4')
    .toLowerCase()
    .replace(/[\s_]+/g, '');
  if (raw === '5' || raw === '5b' || raw === 'pi5' || raw === 'raspberrypi5') return '5';
  if (raw.includes('zero')) return 'zero';
  if (raw.includes('pico')) return 'pico';
  return '4';
}

function scaleX(widthMm: number): number {
  return widthMm / PI4_NOMINAL_W_MM;
}

function scaleZ(depthMm: number): number {
  return depthMm / PI4_NOMINAL_D_MM;
}

/** Map official-drawing millimetres (USB-C/HDMI left, GPIO +Z) into the component box. */
export function pi4FromCorner(widthMm: number, depthMm: number, x: number, z: number): { x: number; z: number } {
  return {
    x: -widthMm / 2 + x * scaleX(widthMm),
    z: -depthMm / 2 + z * scaleZ(depthMm),
  };
}

function pcbThickness(component: Component): number {
  if (raspberryPiVariant(component) === '4') return PI4_PCB_MM;
  const [, h] = component.dimensions;
  return Math.min(h * 0.18, 1.6);
}

function gpioHeaderCenter(component: Component): Vec3 {
  const [w, , d] = component.dimensions;
  const z = d / 2 - HEADER_PITCH_MM;
  if (raspberryPiVariant(component) === '4') {
    return [pi4FromCorner(w, d, PI4_GPIO_CENTER_X_MM, 0).x, 0, z];
  }
  return [-w * 0.08, 0, z];
}

export function raspberryPiPinTipY(component: Component): number {
  return headerPinTipY(pcbThickness(component) / 2, 'male');
}

function addPcb(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  w: number,
  pcbH: number,
  d: number,
  color: string,
): void {
  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, pcbH, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.12 }),
  );
  pcb.name = 'raspberry-pi-pcb';
  meshes.push(pcb);
}

function addGpio(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  component: Component,
  look?: ReturnType<typeof createHeaderLook>,
): void {
  const pcbH = pcbThickness(component);
  addPinHeader(THREE, group, meshes, {
    columns: 20,
    rows: 2,
    // Stacking-style contacts: recessed female wells vanish from the default +Z camera.
    contact: 'male',
    pcbTopY: pcbH / 2,
    center: gpioHeaderCenter(component),
    look,
    namePrefix: 'raspberry-pi-gpio',
    housingName: 'raspberry-pi-gpio',
  });
}

function addSoc(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  x: number,
  pcbH: number,
  z: number,
  size: number,
  color = '#1a1a1a',
): void {
  const soc = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(size, 1.4, size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.25 }),
    [x, pcbH / 2 + 0.7, z],
  );
  soc.name = 'raspberry-pi-soc';
  meshes.push(soc);
}

function portY(pcbH: number, height: number): number {
  return pcbH / 2 + height / 2 - 0.15;
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
    new THREE.CylinderGeometry(PI4_HOLE_R_MM, PI4_HOLE_R_MM, PI4_PCB_MM + 0.35, 18),
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
    new THREE.BoxGeometry(1.6, 0.55, 0.9),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.08, emissive: color, emissiveIntensity: 0.28 }),
    position,
  );
  led.name = name;
  meshes.push(led);
}

function addMicroHdmi(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  position: Vec3,
  metal: import('three').Material,
  cavity: import('three').Material,
  tongue: import('three').Material,
  name: string,
): void {
  const { depth, width, height } = MICRO_HDMI_MM;
  const shell = addMesh(THREE, group, new THREE.BoxGeometry(depth, height, width), metal, position);
  shell.name = name;
  meshes.push(shell);
  // WHY: a flush face picks up shadow acne; overlap the metal so the Type-D opening reads as a hole.
  const cavityD = depth * 0.55;
  const cavityX = position[0] - depth / 2 + cavityD / 2 - 0.35;
  const hole = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(cavityD, height * 0.52, width * 0.62),
    cavity,
    [cavityX, position[1], position[2]],
  );
  hole.name = `${name}:cavity`;
  meshes.push(hole);
  const tongueMesh = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(depth * 0.4, 0.45, width * 0.42),
    tongue,
    [cavityX + 0.2, position[1] - height * 0.08, position[2]],
  );
  tongueMesh.name = `${name}:tongue`;
  meshes.push(tongueMesh);
}

function addRj45(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  position: Vec3,
  metal: import('three').Material,
  plastic: import('three').Material,
): void {
  const { depth, width, height } = RJ45_MM;
  const shell = addMesh(THREE, group, new THREE.BoxGeometry(depth, height, width), metal, position);
  shell.name = 'raspberry-pi-rj45';
  meshes.push(shell);
  const cavityD = depth * 0.42;
  const faceX = position[0] + depth / 2;
  const cavity = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(cavityD, height * 0.62, width * 0.7),
    plastic,
    [faceX - cavityD / 2 + 0.35, position[1] - height * 0.04, position[2]],
  );
  cavity.name = 'raspberry-pi-rj45:cavity';
  meshes.push(cavity);
  const contacts = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(cavityD * 0.55, 0.7, width * 0.5),
    new THREE.MeshStandardMaterial({ color: '#d7c089', roughness: 0.32, metalness: 0.42 }),
    [faceX - cavityD * 0.45, position[1] - height * 0.18, position[2]],
  );
  contacts.name = 'raspberry-pi-rj45:contacts';
  meshes.push(contacts);
  for (const [i, color] of ['#3dcc6a', '#e2b03a'].entries()) {
    addLed(
      THREE,
      group,
      meshes,
      [faceX - 1.1, position[1] + height * 0.28, position[2] + (i === 0 ? -width * 0.28 : width * 0.28)],
      color,
      `raspberry-pi-rj45-led:${i}`,
    );
  }
}

function addAudioJack(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  position: Vec3,
  plastic: import('three').Material,
  metal: import('three').Material,
): void {
  const alongX: Vec3 = [0, 0, Math.PI / 2];
  const { depth, radius } = AUDIO_JACK_MM;
  const body = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius, radius, depth * 0.72, 20),
    plastic,
    [position[0] + 1.2, position[1], position[2]],
    alongX,
  );
  body.name = 'raspberry-pi-audio';
  meshes.push(body);
  const sleeve = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, depth * 0.22, 20),
    metal,
    [position[0] - depth * 0.32, position[1], position[2]],
    alongX,
  );
  sleeve.name = 'raspberry-pi-audio-sleeve';
  meshes.push(sleeve);
  const bore = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, depth * 0.28, 14),
    new THREE.MeshStandardMaterial({ color: '#0b0b0b', roughness: 0.78, metalness: 0.08 }),
    [position[0] - depth * 0.34, position[1], position[2]],
    alongX,
  );
  bore.name = 'raspberry-pi-audio-bore';
  meshes.push(bore);
}

/**
 * Pi 4 Model B: green 85 x 56 mm PCB from the published mechanical drawing,
 * dual micro-HDMI, USB-C, TRRS, stacked USB-A, magjack, CSI/DSI, and a silver SoC lid.
 */
function buildRaspberryPi4(
  THREE: ThreeModule,
  component: Component,
  group: import('three').Group,
  meshes: import('three').Mesh[],
): void {
  const [w, , d] = component.dimensions;
  const pcbH = PI4_PCB_MM;
  const pcbTop = pcbH / 2;
  const look = createHeaderLook(THREE);
  // Metalness stays moderate: this scene has no environment map, so 0.8 silver goes black.
  const metal = new THREE.MeshStandardMaterial({ color: '#c5ccd3', roughness: 0.32, metalness: 0.4 });
  const jackMetal = new THREE.MeshStandardMaterial({ color: '#8e97a1', roughness: 0.36, metalness: 0.38 });
  const dark = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.62, metalness: 0.12 });
  const cavity = new THREE.MeshStandardMaterial({ color: '#14161a', roughness: 0.72, metalness: 0.12 });
  const chip = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.48, metalness: 0.18 });
  const cream = new THREE.MeshStandardMaterial({ color: '#d8d2c0', roughness: 0.7, metalness: 0.04 });

  addPcb(THREE, group, meshes, w, pcbH, d, '#5fa83a');

  const holes: ReadonlyArray<readonly [number, number]> = [
    [PI4_EDGE_INSET_MM, PI4_EDGE_INSET_MM],
    [PI4_EDGE_INSET_MM + PI4_HOLE_SPACING_X_MM, PI4_EDGE_INSET_MM],
    [PI4_EDGE_INSET_MM, PI4_EDGE_INSET_MM + PI4_HOLE_SPACING_Z_MM],
    [PI4_EDGE_INSET_MM + PI4_HOLE_SPACING_X_MM, PI4_EDGE_INSET_MM + PI4_HOLE_SPACING_Z_MM],
  ];
  holes.forEach(([hx, hz], index) => {
    const at = pi4FromCorner(w, d, hx, hz);
    addHole(THREE, group, meshes, at.x, at.z, `raspberry-pi-hole:${index}`);
  });

  addGpio(THREE, group, meshes, component, look);

  const socAt = pi4FromCorner(w, d, PI4_SOC_X_MM, PI4_SOC_Z_MM);
  const socH = 2.4;
  const soc = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(PI4_SOC_MM, socH, PI4_SOC_MM),
    metal,
    [socAt.x, pcbTop + socH / 2, socAt.z],
  );
  soc.name = 'raspberry-pi-soc';
  meshes.push(soc);

  const ram = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(12.2, 1.05, 14.2),
    chip,
    [socAt.x + 14.2 * scaleX(w), pcbTop + 0.55, socAt.z],
  );
  ram.name = 'raspberry-pi-ram';
  meshes.push(ram);

  const pmicAt = pi4FromCorner(w, d, 12, PI4_USBC_Z_MM - 6);
  const pmic = addMesh(THREE, group, new THREE.BoxGeometry(6.4, 1.1, 6.4), chip, [pmicAt.x, pcbTop + 0.55, pmicAt.z]);
  pmic.name = 'raspberry-pi-pmic';
  meshes.push(pmic);

  const usbCtlAt = pi4FromCorner(w, d, 62, PI4_USB3_Z_MM);
  const usbCtl = addMesh(THREE, group, new THREE.BoxGeometry(8.2, 1.05, 8.2), chip, [usbCtlAt.x, pcbTop + 0.55, usbCtlAt.z]);
  usbCtl.name = 'raspberry-pi-usbctl';
  meshes.push(usbCtl);

  const wifiAt = pi4FromCorner(w, d, 14, 41);
  const wifi = addMesh(THREE, group, new THREE.BoxGeometry(4.8, 0.7, 6.2), metal, [wifiAt.x, pcbTop + 0.4, wifiAt.z]);
  wifi.name = 'raspberry-pi-wifi';
  meshes.push(wifi);
  // Keepout sits in the USB-C / GPIO corner, left of the header, raised to avoid PCB z-fighting.
  const antAt = pi4FromCorner(w, d, 5.2, 53.2);
  const antArmA = addMesh(THREE, group, new THREE.BoxGeometry(8.5, 0.22, 1.6), cream, [antAt.x, pcbTop + 0.12, antAt.z]);
  antArmA.name = 'raspberry-pi-antenna';
  meshes.push(antArmA);
  const antArmB = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(1.6, 0.22, 7.2),
    cream,
    [pi4FromCorner(w, d, 2.2, 50.2).x, pcbTop + 0.12, pi4FromCorner(w, d, 2.2, 50.2).z],
  );
  antArmB.name = 'raspberry-pi-antenna-arm';
  meshes.push(antArmB);

  const usbcAt = pi4FromCorner(w, d, 0, PI4_USBC_Z_MM);
  addUsbC(THREE, group, meshes, {
    position: [-w / 2 + USB_C_MM.depth / 2 - 1.2, portY(pcbH, USB_C_MM.height), usbcAt.z],
    facing: '-x',
    namePrefix: 'raspberry-pi-usbc',
  });

  const hdmiMetal = new THREE.MeshStandardMaterial({ color: '#b7bec6', roughness: 0.34, metalness: 0.4 });
  const hdmiTongue = new THREE.MeshStandardMaterial({ color: '#d8dde3', roughness: 0.48, metalness: 0.18 });
  for (const [i, zMm] of [PI4_HDMI0_Z_MM, PI4_HDMI1_Z_MM].entries()) {
    const at = pi4FromCorner(w, d, 0, zMm);
    addMicroHdmi(
      THREE,
      group,
      meshes,
      [-w / 2 + MICRO_HDMI_MM.depth / 2 - 1.5, portY(pcbH, MICRO_HDMI_MM.height), at.z],
      hdmiMetal,
      cavity,
      hdmiTongue,
      i === 0 ? 'raspberry-pi-hdmi:0' : 'raspberry-pi-hdmi:1',
    );
  }

  const audioAt = pi4FromCorner(w, d, 0, PI4_AUDIO_Z_MM);
  addAudioJack(
    THREE,
    group,
    meshes,
    [-w / 2 + AUDIO_JACK_MM.depth / 2 - 2.2, pcbTop + AUDIO_JACK_MM.radius - 0.35, audioAt.z],
    dark,
    metal,
  );

  const usbX = w / 2 - USB_A_STACKED_MM.depth / 2 + PI4_USB_ETH_OVERHANG_MM;
  const usbY = portY(pcbH, USB_A_STACKED_MM.height);
  addUsbA(THREE, group, meshes, {
    position: [usbX, usbY, pi4FromCorner(w, d, 0, PI4_USB3_Z_MM).z],
    facing: '+x',
    stacked: true,
    generation: 3,
    namePrefix: 'raspberry-pi-usba:3',
  });
  addUsbA(THREE, group, meshes, {
    position: [usbX, usbY, pi4FromCorner(w, d, 0, PI4_USB2_Z_MM).z],
    facing: '+x',
    stacked: true,
    generation: 2,
    namePrefix: 'raspberry-pi-usba:2',
  });

  const ethAt = pi4FromCorner(w, d, 0, PI4_ETH_Z_MM);
  addRj45(THREE, group, meshes, [w / 2 - RJ45_MM.depth / 2 + PI4_USB_ETH_OVERHANG_MM, portY(pcbH, RJ45_MM.height), ethAt.z], jackMetal, dark);

  const dsi = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(20, 2.4, 4.2),
    dark,
    [pi4FromCorner(w, d, 24.5, 2.2).x, pcbTop + 1.2, pi4FromCorner(w, d, 24.5, 2.2).z],
  );
  dsi.name = 'raspberry-pi-dsi';
  meshes.push(dsi);
  const csi = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(22, 2.4, 4.2),
    dark,
    [pi4FromCorner(w, d, 62, 2.2).x, pcbTop + 1.2, pi4FromCorner(w, d, 62, 2.2).z],
  );
  csi.name = 'raspberry-pi-csi';
  meshes.push(csi);

  addPinHeader(THREE, group, meshes, {
    columns: 2,
    rows: 2,
    contact: 'male',
    heightMm: 8.5,
    pcbTopY: pcbTop,
    center: [
      pi4FromCorner(w, d, PI4_EDGE_INSET_MM + PI4_HOLE_SPACING_X_MM, 0).x,
      0,
      pi4FromCorner(w, d, 0, PI4_NOMINAL_D_MM - PI4_EDGE_INSET_MM - PI4_POE_OFFSET_Z_MM).z,
    ],
    along: 'x',
    look,
    namePrefix: 'raspberry-pi-poe',
    housingName: 'raspberry-pi-poe',
  });

  const sd = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(11.5, 1.5, 12),
    dark,
    [-w / 2 + 4.2, -pcbTop - 0.35, pi4FromCorner(w, d, 0, 26).z],
  );
  sd.name = 'raspberry-pi-sd';
  meshes.push(sd);
  const sdCard = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(4.2, 0.8, 11),
    cream,
    [-w / 2 - 0.4, -pcbTop - 0.35, pi4FromCorner(w, d, 0, 26).z],
  );
  sdCard.name = 'raspberry-pi-sd-card';
  meshes.push(sdCard);

  addLed(THREE, group, meshes, [pi4FromCorner(w, d, 11.5, PI4_USBC_Z_MM - 3.2).x, pcbTop + 0.35, pi4FromCorner(w, d, 11.5, PI4_USBC_Z_MM - 3.2).z], '#d94a3a', 'raspberry-pi-led-pwr');
  addLed(THREE, group, meshes, [pi4FromCorner(w, d, 11.5, PI4_USBC_Z_MM - 5.4).x, pcbTop + 0.35, pi4FromCorner(w, d, 11.5, PI4_USBC_Z_MM - 5.4).z], '#3dcc6a', 'raspberry-pi-led-act');
}

export function buildRaspberryPi(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, , d] = component.dimensions;
  const variant = raspberryPiVariant(component);
  const pcbH = pcbThickness(component);
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2d32', roughness: 0.45, metalness: 0.4 });

  if (variant === 'pico') {
    addPcb(THREE, group, meshes, w, pcbH, d, '#78c2e0');
    addSoc(THREE, group, meshes, -w * 0.08, pcbH, 0, Math.min(w, d) * 0.28);
    addMicroUsb(THREE, group, meshes, {
      position: [-w / 2 + MICRO_USB_MM.depth / 2, portY(pcbH, MICRO_USB_MM.height), 0],
      facing: '-x',
      namePrefix: 'raspberry-pi-usb',
    });
    const look = createHeaderLook(THREE);
    for (const side of [-1, 1] as const) {
      addPinHeader(THREE, group, meshes, {
        columns: 20,
        rows: 1,
        contact: 'male',
        pcbTopY: pcbH / 2,
        center: [0, 0, side * (d / 2 - HEADER_PITCH_MM / 2)],
        look,
        namePrefix: 'raspberry-pi-header',
        housingName: `raspberry-pi-header:${side < 0 ? 'neg' : 'pos'}`,
      });
    }
    return { group, meshes };
  }

  if (variant === 'zero') {
    addPcb(THREE, group, meshes, w, pcbH, d, '#6cc04a');
    addGpio(THREE, group, meshes, component);
    addSoc(THREE, group, meshes, 0, pcbH, 0, Math.min(w, d) * 0.22);
    const miniHdmi = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(6.5, 3.2, 7.5),
      new THREE.MeshStandardMaterial({ color: '#8d6e2f', roughness: 0.4, metalness: 0.55 }),
      [-w / 2 + 3.4, pcbH / 2 + 1.5, d * 0.28],
    );
    miniHdmi.name = 'raspberry-pi-hdmi';
    meshes.push(miniHdmi);
    addMicroUsb(THREE, group, meshes, {
      position: [-w / 2 + MICRO_USB_MM.depth / 2, portY(pcbH, MICRO_USB_MM.height), 0.02 * d],
      facing: '-x',
      namePrefix: 'raspberry-pi-usb:otg',
    });
    addMicroUsb(THREE, group, meshes, {
      position: [-w / 2 + MICRO_USB_MM.depth / 2, portY(pcbH, MICRO_USB_MM.height), -d * 0.28],
      facing: '-x',
      namePrefix: 'raspberry-pi-usb:power',
    });
    const csi = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(4, 1.2, Math.min(d * 0.42, 16)),
      dark,
      [w / 2 - 3, pcbH / 2 + 0.7, 0],
    );
    csi.name = 'raspberry-pi-csi';
    meshes.push(csi);
    return { group, meshes };
  }

  if (variant === '4') {
    buildRaspberryPi4(THREE, component, group, meshes);
    return { group, meshes };
  }

  addPcb(THREE, group, meshes, w, pcbH, d, '#6cc04a');
  addGpio(THREE, group, meshes, component);
  addSoc(THREE, group, meshes, w * 0.08, pcbH, d * 0.08, 14);

  addUsbC(THREE, group, meshes, {
    position: [-w / 2 + USB_C_MM.depth / 2, portY(pcbH, USB_C_MM.height), d * 0.32],
    facing: '-x',
    namePrefix: 'raspberry-pi-usbc',
  });

  for (const [i, z] of [0.08, -0.12].entries()) {
    const hdmi = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(7.5, 3.4, 8.5),
      new THREE.MeshStandardMaterial({ color: '#8d6e2f', roughness: 0.4, metalness: 0.55 }),
      [-w / 2 + 3.8, pcbH / 2 + 1.6, d * z],
    );
    hdmi.name = i === 0 ? 'raspberry-pi-hdmi:0' : 'raspberry-pi-hdmi:1';
    meshes.push(hdmi);
  }

  const usbX = w / 2 - USB_A_STACKED_MM.depth / 2 + 1.2;
  const usbY = portY(pcbH, USB_A_STACKED_MM.height);
  const usbGap = 2.2;
  const rj45Z = d * 0.28;
  const usb3Z = rj45Z - 8 - usbGap - USB_A_STACKED_MM.width / 2;
  const usb2Z = usb3Z - USB_A_STACKED_MM.width - usbGap;
  addUsbA(THREE, group, meshes, {
    position: [usbX, usbY, usb3Z],
    facing: '+x',
    stacked: true,
    generation: 3,
    namePrefix: 'raspberry-pi-usba:3',
  });
  addUsbA(THREE, group, meshes, {
    position: [usbX, usbY, usb2Z],
    facing: '+x',
    stacked: true,
    generation: 2,
    namePrefix: 'raspberry-pi-usba:2',
  });

  const rj45 = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(16, 13.5, 16),
    new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.45, metalness: 0.35 }),
    [w / 2 - 8, pcbH / 2 + 6.6, rj45Z],
  );
  rj45.name = 'raspberry-pi-rj45';
  meshes.push(rj45);

  const pcie = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(6, 1.4, 22),
    dark,
    [-w * 0.08, pcbH / 2 + 0.8, -d / 2 + 4],
  );
  pcie.name = 'raspberry-pi-pcie';
  meshes.push(pcie);
  const fan = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(8, 4.5, 8),
    new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.65, metalness: 0.12 }),
    [w * 0.22, pcbH / 2 + 2.4, d * 0.08],
  );
  fan.name = 'raspberry-pi-fan';
  meshes.push(fan);

  return { group, meshes };
}

function normalizePinId(id: string): string {
  return id.trim().toUpperCase().replace(/[\s_\-]+/g, '');
}

/** BCM GPIO n -> physical header pin. `GPIO2` is SDA (pin 3), not physical pin 2. */
const BCM_TO_HEADER: Record<number, number> = {
  0: 27,
  1: 28,
  2: 3,
  3: 5,
  4: 7,
  5: 29,
  6: 31,
  7: 26,
  8: 24,
  9: 21,
  10: 19,
  11: 23,
  12: 32,
  13: 33,
  14: 8,
  15: 10,
  16: 36,
  17: 11,
  18: 12,
  19: 35,
  20: 38,
  21: 40,
  22: 15,
  23: 16,
  24: 18,
  25: 22,
  26: 37,
  27: 13,
};

/** 40-pin header numbers, 1 at USB-C, odd pins on the board-edge (+Z) row. */
function gpioHeaderPinNumber(key: string): number | undefined {
  const physical = key.match(/^PIN(\d{1,2})$/);
  if (physical) {
    const n = Number(physical[1]);
    if (n >= 1 && n <= 40) return n;
  }
  const bcm = key.match(/^(?:GP|GPIO|BCM)(\d{1,2})$/);
  if (bcm) return BCM_TO_HEADER[Number(bcm[1])];
  const aliases: Record<string, number> = {
    '3V3': 1,
    '3.3V': 1,
    '3V': 1,
    SDA: 3,
    SCL: 5,
    TX: 8,
    TXD: 8,
    RX: 10,
    RXD: 10,
    MOSI: 19,
    MISO: 21,
    SCLK: 23,
    SCK: 23,
    CE0: 24,
    CE1: 26,
    IDSD: 27,
    IDSC: 28,
  };
  if (key === '5V' || key === 'VCC' || key === 'VDD') return 2;
  if (key === 'GND' || key === 'GROUND') return 6;
  return aliases[key];
}

function gpioPinXZ(center: Vec3, pinNumber: number): { x: number; z: number } {
  const clamped = Math.max(1, Math.min(40, pinNumber));
  const column = Math.floor((clamped - 1) / 2);
  const row = clamped % 2 === 1 ? 1 : 0;
  return {
    x: center[0] + headerColumnOffset(column, 20),
    z: center[2] + headerRowOffset(row, 2),
  };
}

function pi4PortLocal(
  component: Component,
  kind: 'usbc' | 'hdmi0' | 'hdmi1' | 'audio' | 'eth' | 'usb3' | 'usb2' | 'csi' | 'dsi',
): Vec3 {
  const [w, , d] = component.dimensions;
  const pcbH = PI4_PCB_MM;
  if (kind === 'usbc') {
    return [-w / 2, portY(pcbH, USB_C_MM.height), pi4FromCorner(w, d, 0, PI4_USBC_Z_MM).z];
  }
  if (kind === 'hdmi0' || kind === 'hdmi1') {
    const zMm = kind === 'hdmi0' ? PI4_HDMI0_Z_MM : PI4_HDMI1_Z_MM;
    return [-w / 2, portY(pcbH, MICRO_HDMI_MM.height), pi4FromCorner(w, d, 0, zMm).z];
  }
  if (kind === 'audio') {
    return [-w / 2, pcbH / 2 + AUDIO_JACK_MM.radius, pi4FromCorner(w, d, 0, PI4_AUDIO_Z_MM).z];
  }
  if (kind === 'eth') {
    return [w / 2, portY(pcbH, RJ45_MM.height), pi4FromCorner(w, d, 0, PI4_ETH_Z_MM).z];
  }
  if (kind === 'usb3') {
    return [w / 2, portY(pcbH, USB_A_STACKED_MM.height), pi4FromCorner(w, d, 0, PI4_USB3_Z_MM).z];
  }
  if (kind === 'usb2') {
    return [w / 2, portY(pcbH, USB_A_STACKED_MM.height), pi4FromCorner(w, d, 0, PI4_USB2_Z_MM).z];
  }
  if (kind === 'csi') {
    const at = pi4FromCorner(w, d, 62, 2.2);
    return [at.x, pcbH / 2 + 1.2, at.z];
  }
  const at = pi4FromCorner(w, d, 24.5, 2.2);
  return [at.x, pcbH / 2 + 1.2, at.z];
}

export function resolveRaspberryPiPinPosition(
  component: Component,
  pin: Pin,
  context: PinLayoutContext,
): Vec3 {
  const variant = raspberryPiVariant(component);
  const [w, , d] = component.dimensions;
  const pcbH = pcbThickness(component);
  const key = normalizePinId(pin.id);
  const tipY = raspberryPiPinTipY(component);

  if (variant === 'pico') {
    if (key === 'USB' || key === 'VBUS' || key === '5V') {
      return [-w / 2, portY(pcbH, MICRO_USB_MM.height), 0];
    }
    const gp = key.match(/^GP(\d{1,2})$/);
    const index = gp ? Math.max(0, Math.min(19, Number(gp[1]))) : Math.max(0, Math.min(19, context.index));
    const z = pin.side === 'left' ? -(d / 2 - HEADER_PITCH_MM / 2) : d / 2 - HEADER_PITCH_MM / 2;
    return [headerColumnOffset(index, 20), tipY, z];
  }

  const gpioCenter = gpioHeaderCenter(component);
  const gpioN = gpioHeaderPinNumber(key);
  if (gpioN !== undefined) {
    const at = gpioPinXZ(gpioCenter, gpioN);
    return [at.x, tipY, at.z];
  }
  if (key === 'GPIO' || key === 'HEADER' || key === 'HAT') {
    return [gpioCenter[0], tipY, gpioCenter[2]];
  }

  if (variant === '4') {
    if (key === 'USBC' || key === 'POWER' || key === 'PD') return pi4PortLocal(component, 'usbc');
    if (key === 'HDMI' || key === 'HDMI0') return pi4PortLocal(component, 'hdmi0');
    if (key === 'HDMI1') return pi4PortLocal(component, 'hdmi1');
    if (key === 'AUDIO' || key === 'JACK' || key === 'AV' || key === 'TRRS') return pi4PortLocal(component, 'audio');
    if (key === 'ETH' || key === 'RJ45' || key === 'LAN' || key === 'ETHERNET') return pi4PortLocal(component, 'eth');
    if (key === 'USB3' || key === 'USB') return pi4PortLocal(component, 'usb3');
    if (key === 'USB2') return pi4PortLocal(component, 'usb2');
    if (key === 'CSI' || key === 'CAM' || key === 'CAMERA') return pi4PortLocal(component, 'csi');
    if (key === 'DSI' || key === 'DISPLAY') return pi4PortLocal(component, 'dsi');
  }

  if (variant === '5') {
    if (key === 'USBC' || key === 'POWER' || key === 'PD') {
      return [-w / 2, portY(pcbH, USB_C_MM.height), d * 0.32];
    }
    if (key === 'HDMI' || key === 'HDMI0') return [-w / 2, pcbH / 2 + 1.6, d * 0.08];
    if (key === 'PCIE' || key === 'PCI') return [-w * 0.08, pcbH / 2 + 0.8, -d / 2 + 4];
    if (key === 'ETH' || key === 'RJ45' || key === 'LAN') return [w / 2, pcbH / 2 + 6.6, d * 0.28];
  }

  if (variant === 'zero') {
    if (key === 'USB' || key === 'OTG' || key === '5V') {
      return [-w / 2, portY(pcbH, MICRO_USB_MM.height), 0.02 * d];
    }
    if (key === 'HDMI') return [-w / 2 + 3.4, pcbH / 2 + 1.5, d * 0.28];
  }

  const column = Math.max(0, Math.min(19, context.index));
  return [gpioCenter[0] + headerColumnOffset(column, 20), tipY, gpioCenter[2]];
}

export const raspberryPiModel: ModelDefinition = {
  kind: 'raspberry-pi',
  build: buildRaspberryPi,
  resolvePinPosition: resolveRaspberryPiPinPosition,
  hidePinMarkers: true,
};
