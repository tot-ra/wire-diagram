import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** 2020 V-slot extrusion: black bar with a recessed groove, not a coplanar decal. */
export function buildExtrusion(
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
    new THREE.MeshStandardMaterial({ color: '#2a2d32', roughness: 0.45, metalness: 0.55 }),
  );
  body.name = 'extrusion-body';
  meshes.push(body);

  const groove = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.98, Math.max(h * 0.22, 3), Math.max(d * 0.28, 4)),
    new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.55, metalness: 0.4 }),
    [0, h / 2 - Math.max(h * 0.08, 1.2), 0],
  );
  groove.name = 'extrusion-groove';
  meshes.push(groove);

  return { group, meshes };
}

export const extrusionModel: ModelDefinition = {
  kind: 'extrusion',
  build: buildExtrusion,
};
