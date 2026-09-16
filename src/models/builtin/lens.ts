import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** CS/C varifocal barrel: stacked rings plus a front glass disk. */
export function buildLens(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const radius = Math.min(h, d) / 2;

  const barrel = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius * 0.88, radius * 0.92, w * 0.72, 24),
    new THREE.MeshStandardMaterial({ color: '#15171b', roughness: 0.48, metalness: 0.35 }),
    [0, 0, 0],
    [0, 0, Math.PI / 2],
  );
  barrel.name = 'lens-barrel';
  meshes.push(barrel);

  const ring = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, w * 0.14, 24),
    new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.42, metalness: 0.4 }),
    [w * 0.08, 0, 0],
    [0, 0, Math.PI / 2],
  );
  ring.name = 'lens-ring';
  meshes.push(ring);

  const glass = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, 1.4, 24),
    new THREE.MeshStandardMaterial({
      color: '#7ea4c9',
      roughness: 0.08,
      metalness: 0.2,
      emissive: '#1a3350',
      emissiveIntensity: 0.2,
    }),
    [w / 2 - 0.8, 0, 0],
    [0, 0, Math.PI / 2],
  );
  glass.name = 'lens-glass';
  meshes.push(glass);

  return { group, meshes };
}

export const lensModel: ModelDefinition = {
  kind: 'lens',
  build: buildLens,
};
