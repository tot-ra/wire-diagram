import type { Vec3 } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ThreeModule } from '../types.js';

/** Reusable USB shells. Depth is into the board, width across the port, height along Y. */
export const USB_A_SINGLE_MM = { depth: 14, width: 14.5, height: 7 } as const;
export const USB_A_STACKED_MM = { depth: 16.5, width: 14.8, height: 15.8 } as const;
export const USB_C_MM = { depth: 7.5, width: 9, height: 3.2 } as const;
export const MICRO_USB_MM = { depth: 5.6, width: 7.8, height: 2.6 } as const;
/** Through-hole USB Type-B receptacle used on Arduino UNO R3. Face is nearly square. */
export const USB_B_MM = { depth: 16.3, width: 12.0, height: 10.9 } as const;

export type UsbFacing = '+x' | '-x' | '+z' | '-z';
export type UsbAGeneration = 2 | 3;

export interface UsbLook {
  shell: import('three').Material;
  cavity: import('three').Material;
  tongue: import('three').Material;
}

export interface AddUsbOptions {
  position: Vec3;
  facing: UsbFacing;
  namePrefix: string;
  look?: UsbLook;
}

export interface AddUsbAOptions extends AddUsbOptions {
  stacked?: boolean;
  generation?: UsbAGeneration;
}

export function createUsbLook(THREE: ThreeModule, tongueColor: string): UsbLook {
  return {
    shell: new THREE.MeshStandardMaterial({ color: '#d8dee6', roughness: 0.38, metalness: 0.42 }),
    cavity: new THREE.MeshStandardMaterial({ color: '#14161a', roughness: 0.72, metalness: 0.12 }),
    tongue: new THREE.MeshStandardMaterial({ color: tongueColor, roughness: 0.48, metalness: 0.18 }),
  };
}

export function usbATongueColor(generation: UsbAGeneration = 2): string {
  return generation === 3 ? '#2f5aa8' : '#1a1a1a';
}

export function usbBoxSize(
  depth: number,
  height: number,
  width: number,
  facing: UsbFacing,
): Vec3 {
  if (facing === '+x' || facing === '-x') return [depth, height, width];
  return [width, height, depth];
}

export function usbFacingDelta(facing: UsbFacing, distance: number): Vec3 {
  if (facing === '+x') return [distance, 0, 0];
  if (facing === '-x') return [-distance, 0, 0];
  if (facing === '+z') return [0, 0, distance];
  return [0, 0, -distance];
}

function addVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function facingExtent(size: Vec3, facing: UsbFacing): number {
  return facing === '+x' || facing === '-x' ? size[0] : size[2];
}

function addNamed(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  created: import('three').Mesh[],
  geometry: import('three').BufferGeometry,
  material: import('three').Material,
  position: Vec3,
  name: string,
  userData: Record<string, unknown>,
): import('three').Mesh {
  const mesh = addMesh(THREE, group, geometry, material, position);
  mesh.name = name;
  mesh.userData = userData;
  meshes.push(mesh);
  created.push(mesh);
  return mesh;
}

/**
 * Dark interior that crosses the shell opening. A flush coplanar face picks up
 * shadow acne; overlapping the metal by a fraction of a millimetre reads as a hole.
 */
function addCavityAndTongue(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  created: import('three').Mesh[],
  options: {
    cavitySize: Vec3;
    cavityPos: Vec3;
    tongueSize: Vec3;
    tonguePos: Vec3;
    look: UsbLook;
    namePrefix: string;
    index: number;
  },
): void {
  addNamed(
    THREE,
    group,
    meshes,
    created,
    new THREE.BoxGeometry(options.cavitySize[0], options.cavitySize[1], options.cavitySize[2]),
    options.look.cavity,
    options.cavityPos,
    `${options.namePrefix}:cavity:${options.index}`,
    { kind: 'usb-cavity', index: options.index },
  );
  addNamed(
    THREE,
    group,
    meshes,
    created,
    new THREE.BoxGeometry(options.tongueSize[0], options.tongueSize[1], options.tongueSize[2]),
    options.look.tongue,
    options.tonguePos,
    `${options.namePrefix}:tongue:${options.index}`,
    { kind: 'usb-tongue', index: options.index },
  );
}

function openingShift(shellSize: Vec3, innerDepth: number, facing: UsbFacing, extra = 0.35): Vec3 {
  const shellExtent = facingExtent(shellSize, facing);
  const distance = shellExtent / 2 - innerDepth / 2 + extra;
  return usbFacingDelta(facing, distance);
}

export function addUsbA(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  options: AddUsbAOptions,
): import('three').Mesh[] {
  const stacked = options.stacked === true;
  const generation = options.generation ?? 2;
  const spec = stacked ? USB_A_STACKED_MM : USB_A_SINGLE_MM;
  const look = options.look ?? createUsbLook(THREE, usbATongueColor(generation));
  const created: import('three').Mesh[] = [];
  const shellSize = usbBoxSize(spec.depth, spec.height, spec.width, options.facing);
  addNamed(
    THREE,
    group,
    meshes,
    created,
    new THREE.BoxGeometry(shellSize[0], shellSize[1], shellSize[2]),
    look.shell,
    options.position,
    options.namePrefix,
    { kind: 'usb-a', stacked, generation },
  );

  const ports = stacked ? 2 : 1;
  const cavityH = stacked ? spec.height * 0.32 : spec.height * 0.52;
  const cavityW = spec.width * 0.58;
  const cavityD = spec.depth * 0.5;
  const tongueH = 1.1;
  const tongueW = spec.width * 0.42;
  const tongueD = spec.depth * 0.38;

  for (let index = 0; index < ports; index += 1) {
    const yOff = stacked ? (index === 0 ? -spec.height * 0.22 : spec.height * 0.22) : 0;
    const cavitySize = usbBoxSize(cavityD, cavityH, cavityW, options.facing);
    const tongueSize = usbBoxSize(tongueD, tongueH, tongueW, options.facing);
    const cavityBase: Vec3 = [options.position[0], options.position[1] + yOff, options.position[2]];
    const cavityPos = addVec(cavityBase, openingShift(shellSize, cavityD, options.facing));
    const tongueY = yOff - cavityH * 0.22;
    const tongueBase: Vec3 = [options.position[0], options.position[1] + tongueY, options.position[2]];
    const tonguePos = addVec(tongueBase, openingShift(shellSize, tongueD, options.facing, 0.15));
    addCavityAndTongue(THREE, group, meshes, created, {
      cavitySize,
      cavityPos,
      tongueSize,
      tonguePos,
      look,
      namePrefix: options.namePrefix,
      index,
    });
  }

  // WHY: default camera looks from +Z, so port openings are in profile. A generation-colored
  // cap on the shell top keeps USB 2 vs USB 3 readable without relying on an environment map.
  const capH = 0.7;
  const capSize = usbBoxSize(spec.depth * 0.72, capH, spec.width * 0.72, options.facing);
  const shellTop = options.position[1] + spec.height / 2;
  const cap = addNamed(
    THREE,
    group,
    meshes,
    created,
    new THREE.BoxGeometry(capSize[0], capSize[1], capSize[2]),
    look.tongue,
    [options.position[0], shellTop, options.position[2]],
    `${options.namePrefix}:cap`,
    { kind: 'usb-cap', generation },
  );
  cap.receiveShadow = false;

  return created;
}

export function addUsbC(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  options: AddUsbOptions,
): import('three').Mesh[] {
  const look = options.look ?? createUsbLook(THREE, '#d8dde3');
  const created: import('three').Mesh[] = [];
  const shellSize = usbBoxSize(USB_C_MM.depth, USB_C_MM.height, USB_C_MM.width, options.facing);
  addNamed(
    THREE,
    group,
    meshes,
    created,
    new THREE.BoxGeometry(shellSize[0], shellSize[1], shellSize[2]),
    look.shell,
    options.position,
    options.namePrefix,
    { kind: 'usb-c' },
  );
  const cavityD = USB_C_MM.depth * 0.7;
  const cavitySize = usbBoxSize(cavityD, USB_C_MM.height * 0.55, USB_C_MM.width * 0.78, options.facing);
  const tongueSize = usbBoxSize(USB_C_MM.depth * 0.5, 0.45, USB_C_MM.width * 0.62, options.facing);
  addCavityAndTongue(THREE, group, meshes, created, {
    cavitySize,
    cavityPos: addVec(options.position, openingShift(shellSize, cavityD, options.facing)),
    tongueSize,
    tonguePos: addVec(options.position, openingShift(shellSize, USB_C_MM.depth * 0.5, options.facing, 0.12)),
    look,
    namePrefix: options.namePrefix,
    index: 0,
  });
  return created;
}

export function addMicroUsb(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  options: AddUsbOptions,
): import('three').Mesh[] {
  const look = options.look ?? createUsbLook(THREE, '#d8dde3');
  const created: import('three').Mesh[] = [];
  const shellSize = usbBoxSize(MICRO_USB_MM.depth, MICRO_USB_MM.height, MICRO_USB_MM.width, options.facing);
  addNamed(
    THREE,
    group,
    meshes,
    created,
    new THREE.BoxGeometry(shellSize[0], shellSize[1], shellSize[2]),
    look.shell,
    options.position,
    options.namePrefix,
    { kind: 'micro-usb' },
  );
  const cavityD = MICRO_USB_MM.depth * 0.68;
  const cavitySize = usbBoxSize(cavityD, MICRO_USB_MM.height * 0.58, MICRO_USB_MM.width * 0.72, options.facing);
  const tongueSize = usbBoxSize(MICRO_USB_MM.depth * 0.48, 0.4, MICRO_USB_MM.width * 0.5, options.facing);
  addCavityAndTongue(THREE, group, meshes, created, {
    cavitySize,
    cavityPos: addVec(options.position, openingShift(shellSize, cavityD, options.facing)),
    tongueSize,
    tonguePos: addVec(options.position, openingShift(shellSize, MICRO_USB_MM.depth * 0.48, options.facing, 0.1)),
    look,
    namePrefix: options.namePrefix,
    index: 0,
  });
  return created;
}

/** Chunky printer-style Type-B jack. Keep metalness moderate: this scene has no environment map. */
export function addUsbB(
  THREE: ThreeModule,
  group: import('three').Group,
  meshes: import('three').Mesh[],
  options: AddUsbOptions,
): import('three').Mesh[] {
  const look = options.look ?? createUsbLook(THREE, '#d8dde3');
  const created: import('three').Mesh[] = [];
  const shellSize = usbBoxSize(USB_B_MM.depth, USB_B_MM.height, USB_B_MM.width, options.facing);
  addNamed(
    THREE,
    group,
    meshes,
    created,
    new THREE.BoxGeometry(shellSize[0], shellSize[1], shellSize[2]),
    look.shell,
    options.position,
    options.namePrefix,
    { kind: 'usb-b' },
  );
  const cavityD = USB_B_MM.depth * 0.62;
  const cavitySize = usbBoxSize(cavityD, USB_B_MM.height * 0.62, USB_B_MM.width * 0.7, options.facing);
  const tongueSize = usbBoxSize(USB_B_MM.depth * 0.42, USB_B_MM.height * 0.28, USB_B_MM.width * 0.38, options.facing);
  addCavityAndTongue(THREE, group, meshes, created, {
    cavitySize,
    cavityPos: addVec(options.position, openingShift(shellSize, cavityD, options.facing)),
    tongueSize,
    tonguePos: addVec(options.position, openingShift(shellSize, USB_B_MM.depth * 0.42, options.facing, 0.12)),
    look,
    namePrefix: options.namePrefix,
    index: 0,
  });
  return created;
}
