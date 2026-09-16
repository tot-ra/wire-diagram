import type { Component } from '../../types.js';
import { addMesh, cssColor } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

export function buildGenericBoard(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const bodyColor = component.color ? cssColor(THREE, component.color) : new THREE.Color('#1f6b42');

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, h * 0.12, d),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.55,
      metalness: 0.08,
    }),
    [0, 0, 0],
  );
  meshes.push(pcb);

  const silk = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.55, 0.15, d * 0.35),
    new THREE.MeshStandardMaterial({ color: '#ececec', roughness: 0.85, metalness: 0 }),
    [0, h * 0.07, 0],
  );
  meshes.push(silk);

  return { group, meshes };
}

export const boardModel: ModelDefinition = {
  kind: 'board',
  build: buildGenericBoard,
};
