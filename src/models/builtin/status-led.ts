import type { Component } from '../../types.js';
import { addMesh, cssColor } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** Panel-mount 3 mm indicator in a metal bezel, distinct from the through-hole kind: led. */
export function buildStatusLed(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const radius = Math.min(w, d) / 2;
  const color = component.color ? cssColor(THREE, component.color) : new THREE.Color('#3dcc6a');
  const alongX: [number, number, number] = [0, 0, Math.PI / 2];

  const bezel = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius, radius, w * 0.35, 24),
    new THREE.MeshStandardMaterial({ color: '#c5ccd3', roughness: 0.28, metalness: 0.88 }),
    [0, 0, 0],
    alongX,
  );
  bezel.name = 'status-led-bezel';
  meshes.push(bezel);

  const lens = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, w * 0.22, 20),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.22,
      metalness: 0.05,
      emissive: color,
      emissiveIntensity: 0.45,
    }),
    [-w * 0.12, 0, 0],
    alongX,
  );
  lens.name = 'status-led-lens';
  meshes.push(lens);

  const nut = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, w * 0.18, 6),
    new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.35, metalness: 0.8 }),
    [w * 0.22, 0, 0],
    alongX,
  );
  nut.name = 'status-led-nut';
  meshes.push(nut);

  return { group, meshes };
}

export const statusLedModel: ModelDefinition = {
  kind: 'status-led',
  build: buildStatusLed,
};
