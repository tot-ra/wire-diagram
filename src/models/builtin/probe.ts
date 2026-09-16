import type { Component, Vec3 } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

export function buildProbe(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const length = w;
  const radius = Math.min(h, d) / 2;
  const shrinkLength = length * 0.16;
  const shaftLength = length - shrinkLength;
  const alongX: Vec3 = [0, 0, Math.PI / 2];
  const steel = new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.18, metalness: 0.96 });

  const shrink = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, shrinkLength, 24),
    new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.82, metalness: 0.08 }),
    [-length / 2 + shrinkLength / 2, 0, 0],
    alongX,
  );
  shrink.name = 'probe-shrink';
  meshes.push(shrink);

  const shaft = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius, radius, shaftLength, 28),
    steel,
    [-length / 2 + shrinkLength + shaftLength / 2, 0, 0],
    alongX,
  );
  shaft.name = 'probe-shaft';
  meshes.push(shaft);

  return { group, meshes };
}

export const probeModel: ModelDefinition = {
  kind: 'probe',
  build: buildProbe,
};
