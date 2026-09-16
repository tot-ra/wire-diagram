import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** PCB-mount 5.5 mm DC barrel jack. Passive housing; pins are metadata only. */
export function buildBarrelJack(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const alongX: [number, number, number] = [0, 0, Math.PI / 2];
  const outerR = Math.min(h, d) / 2;

  const shell = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(outerR, outerR, w * 0.72, 24),
    new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.55, metalness: 0.25 }),
    [w * 0.08, 0, 0],
    alongX,
  );
  shell.name = 'barrel-jack-shell';
  meshes.push(shell);

  const sleeve = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(outerR * 0.78, outerR * 0.78, w * 0.22, 24),
    new THREE.MeshStandardMaterial({ color: '#c5ccd3', roughness: 0.28, metalness: 0.9 }),
    [-w / 2 + w * 0.12, 0, 0],
    alongX,
  );
  sleeve.name = 'barrel-jack-sleeve';
  meshes.push(sleeve);

  const pin = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(outerR * 0.18, outerR * 0.18, w * 0.35, 12),
    new THREE.MeshStandardMaterial({ color: '#d7c089', roughness: 0.3, metalness: 0.88 }),
    [-w * 0.12, 0, 0],
    alongX,
  );
  pin.name = 'barrel-jack-pin';
  meshes.push(pin);

  const flange = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.22, h * 0.72, d),
    new THREE.MeshStandardMaterial({ color: '#2a2d32', roughness: 0.6, metalness: 0.2 }),
    [w / 2 - w * 0.12, -h * 0.08, 0],
  );
  flange.name = 'barrel-jack-flange';
  meshes.push(flange);

  return { group, meshes };
}

export const barrelJackModel: ModelDefinition = {
  kind: 'barrel-jack',
  build: buildBarrelJack,
};
