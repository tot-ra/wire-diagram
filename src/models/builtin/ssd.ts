import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** M.2 2280 stick with a gold edge connector on -X. */
export function buildSsd(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const body = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: '#1c1f24', roughness: 0.55, metalness: 0.2 }),
  );
  body.name = 'ssd-body';
  meshes.push(body);

  const gold = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(Math.min(w * 0.12, 8), h * 1.15, d * 0.92),
    new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.28, metalness: 0.9 }),
    [-w / 2 + Math.min(w * 0.06, 4), 0, 0],
  );
  gold.name = 'ssd-gold';
  meshes.push(gold);

  const label = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.42, 0.2, d * 0.5),
    new THREE.MeshStandardMaterial({ color: '#ececec', roughness: 0.85, metalness: 0 }),
    [w * 0.08, h / 2 + 0.12, 0],
  );
  label.name = 'ssd-label';
  meshes.push(label);

  return { group, meshes };
}

export const ssdModel: ModelDefinition = {
  kind: 'ssd',
  build: buildSsd,
};
