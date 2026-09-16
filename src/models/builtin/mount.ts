import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** Adjustable 1/4 inch camera bracket: base plate, arm, and screw post. */
export function buildMount(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const base = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, Math.max(h * 0.18, 3), d),
    new THREE.MeshStandardMaterial({ color: '#8a9098', roughness: 0.4, metalness: 0.7 }),
    [0, -h / 2 + 1.6, 0],
  );
  base.name = 'mount-base';
  meshes.push(base);

  const arm = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(Math.max(w * 0.22, 6), h * 0.85, Math.max(d * 0.22, 6)),
    new THREE.MeshStandardMaterial({ color: '#6f757c', roughness: 0.42, metalness: 0.68 }),
    [0, 0, 0],
  );
  arm.name = 'mount-arm';
  meshes.push(arm);

  const screw = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(2, 2, Math.max(h * 0.35, 8), 12),
    new THREE.MeshStandardMaterial({ color: '#d0d4da', roughness: 0.28, metalness: 0.88 }),
    [0, h / 2 - 1, 0],
  );
  screw.name = 'mount-screw';
  meshes.push(screw);

  return { group, meshes };
}

export const mountModel: ModelDefinition = {
  kind: 'mount',
  build: buildMount,
};
