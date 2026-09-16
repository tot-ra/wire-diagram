import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** Thin acrylic optical sample. Slightly proud of a zero-thickness plane. */
export function buildCover(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const sheet = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(Math.max(w, 1.2), h, d),
    new THREE.MeshStandardMaterial({
      color: '#c5d8e8',
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.42,
    }),
  );
  sheet.name = 'cover-sheet';
  meshes.push(sheet);

  return { group, meshes };
}

export const coverModel: ModelDefinition = {
  kind: 'cover',
  build: buildCover,
};
