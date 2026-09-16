import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** 20 kg bench cells are aluminum bars with an I-beam flexure, not a platform on feet. */
export function buildLoadCell(THREE: ThreeModule, component: Component): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const aluminum = new THREE.MeshStandardMaterial({
    color: '#c5ccd3',
    roughness: 0.28,
    metalness: 0.85,
  });
  const endLength = w * 0.28;
  const pocketLength = Math.max(w - endLength * 2, w * 0.3);
  const flange = h * 0.22;
  const web = d * 0.22;
  const holeRadius = Math.min(h, d) * 0.22;

  for (const xSign of [-1, 1] as const) {
    const end = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(endLength, h, d),
      aluminum,
      [xSign * (w / 2 - endLength / 2), 0, 0],
    );
    end.name = xSign < 0 ? 'load-cell-end-neg' : 'load-cell-end-pos';
    meshes.push(end);

    const hole = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(holeRadius, holeRadius, h * 1.08, 20),
      new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.82, metalness: 0.08 }),
      [xSign * (w / 2 - endLength * 0.45), 0, 0],
    );
    hole.name = 'load-cell-hole';
    meshes.push(hole);
  }

  for (const ySign of [-1, 1] as const) {
    const plate = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(pocketLength, flange, d),
      aluminum,
      [0, ySign * (h / 2 - flange / 2), 0],
    );
    plate.name = ySign > 0 ? 'load-cell-flange-top' : 'load-cell-flange-bottom';
    meshes.push(plate);
  }

  const webMesh = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(pocketLength * 0.55, Math.max(h - flange * 2, h * 0.2), web),
    aluminum,
  );
  webMesh.name = 'load-cell-web';
  meshes.push(webMesh);

  const gauge = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(pocketLength * 0.28, 0.4, d * 0.55),
    new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.7, metalness: 0.05 }),
    [0, h / 2 + 0.15, 0],
  );
  gauge.name = 'load-cell-gauge';
  meshes.push(gauge);

  const jacket = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(1.1, 1.1, 12, 12),
    new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.75, metalness: 0.05 }),
    [-w * 0.08, 0, d / 2 + 6],
    [Math.PI / 2, 0, 0],
  );
  jacket.name = 'load-cell-cable';
  meshes.push(jacket);

  return { group, meshes };
}

export const loadCellModel: ModelDefinition = {
  kind: 'load-cell',
  build: buildLoadCell,
};
