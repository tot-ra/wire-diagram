import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** USB brick with a proud blue badge. The badge must not share the housing top
 *  plane: coplanar faces z-fight and pick up shadow acne as gray/black dashes. */
export function buildPowerBlock(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const housing = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: '#20242b', roughness: 0.68, metalness: 0.12 }),
  );
  housing.name = 'power-housing';
  meshes.push(housing);

  const accentH = Math.max(h * 0.1, 1.4);
  const sink = accentH * 0.4;
  const accent = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.78, accentH, d * 0.72),
    new THREE.MeshStandardMaterial({
      color: '#3d7be0',
      roughness: 0.45,
      metalness: 0.2,
      emissive: '#1a3f80',
      emissiveIntensity: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    [0, h / 2 + accentH / 2 - sink, 0],
  );
  accent.name = 'power-accent';
  accent.receiveShadow = false;
  meshes.push(accent);

  const accentTop = h / 2 + accentH - sink;
  const terminalH = Math.max(h * 0.08, 1.1);
  for (let i = 0; i < 2; i += 1) {
    const terminal = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(w * 0.05, w * 0.05, terminalH, 16),
      new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.3, metalness: 0.85 }),
      [(i === 0 ? -1 : 1) * w * 0.28, accentTop + terminalH / 2, 0],
    );
    terminal.name = 'power-terminal';
    meshes.push(terminal);
  }

  return { group, meshes };
}

export const powerModel: ModelDefinition = {
  kind: 'power',
  build: buildPowerBlock,
};
