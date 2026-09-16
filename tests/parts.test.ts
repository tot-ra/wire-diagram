import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  HEADER_PITCH_MM,
  USB_A_STACKED_MM,
  USB_B_MM,
  addPinHeader,
  addUsbA,
  addUsbB,
  usbBoxSize,
} from '../src/models/index.js';

function box(mesh: import('three').Mesh): THREE.BoxGeometry {
  expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
  return mesh.geometry as THREE.BoxGeometry;
}

describe('shared 3D parts', () => {
  it('builds a 2x20 female header with gold contacts and wells', () => {
    const group = new THREE.Group();
    const meshes: import('three').Mesh[] = [];
    addPinHeader(THREE, group, meshes, {
      columns: 20,
      rows: 2,
      contact: 'female',
      pcbTopY: 0.8,
      center: [0, 0, 0],
      namePrefix: 'gpio',
      housingName: 'gpio-housing',
    });
    expect(meshes.find((mesh) => mesh.name === 'gpio-housing')).toBeTruthy();
    expect(meshes.filter((mesh) => mesh.name.startsWith('gpio-pin:'))).toHaveLength(40);
    expect(meshes.filter((mesh) => mesh.name.startsWith('gpio-well:'))).toHaveLength(40);
    const pin = meshes.find((mesh) => mesh.name === 'gpio-pin:0:0')!;
    const well = meshes.find((mesh) => mesh.name === 'gpio-well:0:0')!;
    const housing = meshes.find((mesh) => mesh.name === 'gpio-housing')!;
    const housingTop = housing.position.y + box(housing).parameters.height / 2;
    const wellTop = well.position.y + box(well).parameters.height / 2;
    const wellBottom = well.position.y - box(well).parameters.height / 2;
    expect(wellTop).toBeGreaterThan(housingTop);
    expect(wellBottom).toBeLessThan(housingTop);
    expect(pin.position.x).toBeCloseTo(-((20 - 1) * HEADER_PITCH_MM) / 2);
    expect(pin.position.z).toBeCloseTo(-HEADER_PITCH_MM / 2);
  });

  it('builds stacked USB-A whose cavity crosses the shell opening', () => {
    const group = new THREE.Group();
    const meshes: import('three').Mesh[] = [];
    addUsbA(THREE, group, meshes, {
      position: [0, 0, 0],
      facing: '+x',
      stacked: true,
      generation: 3,
      namePrefix: 'usba',
    });
    const shell = meshes.find((mesh) => mesh.name === 'usba')!;
    const cavity = meshes.find((mesh) => mesh.name === 'usba:cavity:0')!;
    const tongue = meshes.find((mesh) => mesh.name === 'usba:tongue:1')!;
    expect(meshes.filter((mesh) => mesh.name.startsWith('usba:cavity:'))).toHaveLength(2);
    expect(tongue).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'usba:cap')).toBeTruthy();
    const shellSize = usbBoxSize(USB_A_STACKED_MM.depth, USB_A_STACKED_MM.height, USB_A_STACKED_MM.width, '+x');
    const shellFace = shell.position.x + shellSize[0] / 2;
    const cavityGeom = box(cavity);
    const cavityOuter = cavity.position.x + cavityGeom.parameters.width / 2;
    const cavityInner = cavity.position.x - cavityGeom.parameters.width / 2;
    expect(cavityOuter).toBeGreaterThan(shellFace);
    expect(cavityInner).toBeLessThan(shellFace);
  });

  it('builds a USB Type-B shell whose cavity crosses the opening', () => {
    const group = new THREE.Group();
    const meshes: import('three').Mesh[] = [];
    addUsbB(THREE, group, meshes, {
      position: [0, 0, 0],
      facing: '-x',
      namePrefix: 'usbb',
    });
    const shell = meshes.find((mesh) => mesh.name === 'usbb')!;
    const cavity = meshes.find((mesh) => mesh.name === 'usbb:cavity:0')!;
    expect(meshes.find((mesh) => mesh.name === 'usbb:tongue:0')).toBeTruthy();
    const shellSize = usbBoxSize(USB_B_MM.depth, USB_B_MM.height, USB_B_MM.width, '-x');
    const shellFace = shell.position.x - shellSize[0] / 2;
    const cavityGeom = box(cavity);
    const cavityOuter = cavity.position.x - cavityGeom.parameters.width / 2;
    const cavityInner = cavity.position.x + cavityGeom.parameters.width / 2;
    expect(cavityOuter).toBeLessThan(shellFace);
    expect(cavityInner).toBeGreaterThan(shellFace);
  });
});
