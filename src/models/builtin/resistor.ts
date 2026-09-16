import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

function normalizeResistance(value: string): string {
  return value.replace(/\s+/g, '').replace(/Ω/gi, 'ω').toLowerCase();
}

export function matchesResistance(component: Component, expected: string): boolean {
  const resistance = component.properties?.resistance;
  if (typeof resistance !== 'string') return false;
  return normalizeResistance(resistance) === normalizeResistance(expected);
}

export function buildResistor(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, , d] = component.dimensions;
  const bodyLength = Math.max(w, d);
  const bodyRadius = Math.min(w, d) * 0.35;

  const body = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyLength, 24),
    new THREE.MeshStandardMaterial({ color: '#d8cbb8', roughness: 0.72, metalness: 0.05 }),
    [0, 0, 0],
    [0, 0, Math.PI / 2],
  );
  meshes.push(body);

  if (matchesResistance(component, '4.7 kΩ')) {
    const bandColors = ['#f1c40f', '#7d3c98', '#c0392b', '#d4a017'];
    for (let i = 0; i < bandColors.length; i += 1) {
      const band = addMesh(
        THREE,
        group,
        new THREE.CylinderGeometry(bodyRadius * 1.02, bodyRadius * 1.02, bodyLength * 0.07, 24),
        new THREE.MeshStandardMaterial({ color: bandColors[i], roughness: 0.6, metalness: 0.1 }),
        [bodyLength * (-0.24 + i * 0.16), 0, 0],
        [0, 0, Math.PI / 2],
      );
      band.name = `resistor-band-${i}`;
      meshes.push(band);
    }
  }

  for (const xSign of [-1, 1]) {
    const lead = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(bodyRadius * 0.12, bodyRadius * 0.12, bodyLength * 0.45, 12),
      new THREE.MeshStandardMaterial({ color: '#b0b4ba', roughness: 0.25, metalness: 0.9 }),
      [xSign * bodyLength * 0.62, 0, 0],
      [0, 0, Math.PI / 2],
    );
    meshes.push(lead);
  }

  return { group, meshes };
}

export const resistorModel: ModelDefinition = {
  kind: 'resistor',
  build: buildResistor,
};
