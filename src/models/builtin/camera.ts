import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import { addUsbC, USB_C_MM } from '../parts/usb.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** Industrial USB box camera with a CS mount ring and a 1/4 inch foot. */
export function buildCamera(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const body = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.82, h, d),
    new THREE.MeshStandardMaterial({ color: '#1a1c20', roughness: 0.62, metalness: 0.18 }),
  );
  body.name = 'camera-body';
  meshes.push(body);

  const ringR = Math.min(h, d) * 0.28;
  const ring = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(ringR, ringR * 1.08, w * 0.22, 24),
    new THREE.MeshStandardMaterial({ color: '#2f3238', roughness: 0.4, metalness: 0.45 }),
    [w / 2 - w * 0.08, 0, 0],
    [0, 0, Math.PI / 2],
  );
  ring.name = 'camera-cs-ring';
  meshes.push(ring);

  addUsbC(THREE, group, meshes, {
    position: [-w / 2 + USB_C_MM.depth / 2, 0, 0],
    facing: '-x',
    namePrefix: 'camera-usb',
  });

  const tripod = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(2.2, 2.2, 4, 12),
    new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.3, metalness: 0.85 }),
    [0, -h / 2 - 1.6, 0],
  );
  tripod.name = 'camera-tripod';
  meshes.push(tripod);

  return { group, meshes };
}

export const cameraModel: ModelDefinition = {
  kind: 'camera',
  build: buildCamera,
};
