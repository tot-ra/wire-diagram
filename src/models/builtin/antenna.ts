import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** WiFi paddle antenna on a short coax stub. */
export function buildAntenna(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const paddle = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(Math.max(w * 0.35, 4), h * 0.72, Math.max(d * 0.55, 8)),
    new THREE.MeshStandardMaterial({ color: '#1f2126', roughness: 0.55, metalness: 0.2 }),
    [0, h * 0.08, 0],
  );
  paddle.name = 'antenna-paddle';
  meshes.push(paddle);

  const coax = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(1.1, 1.1, h * 0.45, 10),
    new THREE.MeshStandardMaterial({ color: '#22262c', roughness: 0.5, metalness: 0.15 }),
    [0, -h / 2 + h * 0.18, 0],
  );
  coax.name = 'antenna-coax';
  meshes.push(coax);

  return { group, meshes };
}

export const antennaModel: ModelDefinition = {
  kind: 'antenna',
  build: buildAntenna,
};
