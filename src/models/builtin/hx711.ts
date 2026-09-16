import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

export function buildHx711(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, h * 0.08, d),
    new THREE.MeshStandardMaterial({ color: '#1f7a3a', roughness: 0.58, metalness: 0.1 }),
  );
  meshes.push(pcb);

  const chip = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.28, h * 0.07, d * 0.38),
    new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.35, metalness: 0.25 }),
    [0, h * 0.08, 0],
  );
  meshes.push(chip);

  for (let i = 0; i < 2; i += 1) {
    const terminal = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(w * 0.12, h * 0.14, d * 0.18),
      new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.55, metalness: 0.35 }),
      [(i === 0 ? -1 : 1) * w * 0.28, h * 0.06, 0],
    );
    meshes.push(terminal);
    const screw = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(w * 0.025, w * 0.025, h * 0.03, 16),
      new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.25, metalness: 0.9 }),
      [(i === 0 ? -1 : 1) * w * 0.28, h * 0.14, 0],
    );
    meshes.push(screw);
  }

  return { group, meshes };
}

export const hx711Model: ModelDefinition = {
  kind: 'hx711',
  build: buildHx711,
};
