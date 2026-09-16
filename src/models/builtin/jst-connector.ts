import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** JST-XH style 2.54 mm housing. Slot count follows properties.pins when it is 2-6, else 4. */
export function jstPinCount(component: Component): number {
  const raw = component.properties?.pins;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isInteger(n) && n >= 2 && n <= 6) return n;
  return 4;
}

export function buildJstConnector(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const pins = jstPinCount(component);
  const pitch = 2.54;
  const span = (pins - 1) * pitch;

  const housing = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, h * 0.72, d),
    new THREE.MeshStandardMaterial({ color: '#f2f0e8', roughness: 0.72, metalness: 0.04 }),
  );
  housing.name = 'jst-housing';
  meshes.push(housing);

  const latch = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.35, h * 0.22, d * 0.28),
    new THREE.MeshStandardMaterial({ color: '#e7e4da', roughness: 0.7, metalness: 0.04 }),
    [0, h * 0.42, 0],
  );
  latch.name = 'jst-latch';
  meshes.push(latch);

  const startX = -span / 2;
  for (let i = 0; i < pins; i += 1) {
    const slot = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(1.2, h * 0.35, 1.2),
      new THREE.MeshStandardMaterial({ color: '#d7c089', roughness: 0.3, metalness: 0.88 }),
      [startX + i * pitch, -h * 0.12, 0],
    );
    slot.name = 'jst-pin';
    meshes.push(slot);
  }

  return { group, meshes };
}

export const jstConnectorModel: ModelDefinition = {
  kind: 'jst-connector',
  build: buildJstConnector,
};
