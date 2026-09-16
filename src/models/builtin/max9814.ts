import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import { addPinHeader, HEADER_PITCH_MM } from '../parts/pin-header.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** MAX9814 AGC mic amp: longer breakout, electret can, three gain solder pads instead of a trimmer. */
export function buildMax9814(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const pcbH = Math.max(h * 0.28, 1.2);

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, pcbH, d),
    new THREE.MeshStandardMaterial({ color: '#1a4a8c', roughness: 0.52, metalness: 0.12 }),
  );
  pcb.name = 'max9814-pcb';
  meshes.push(pcb);

  const micR = Math.min(d, w) * 0.2;
  const micH = Math.max(h * 0.95, 4.4);
  const mic = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(micR, micR, micH, 20),
    new THREE.MeshStandardMaterial({ color: '#c5ccd3', roughness: 0.32, metalness: 0.88 }),
    [w * 0.32, pcbH / 2 + micH / 2, 0],
  );
  mic.name = 'max9814-mic';
  meshes.push(mic);

  const chip = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.3, 0.85, d * 0.38),
    new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.38, metalness: 0.22 }),
    [0, pcbH / 2 + 0.42, 0],
  );
  chip.name = 'max9814-chip';
  meshes.push(chip);

  for (let i = 0; i < 3; i += 1) {
    const pad = addMesh(
      THREE,
      group,
      new THREE.BoxGeometry(2.2, 0.25, 2.2),
      new THREE.MeshStandardMaterial({ color: '#d7c089', roughness: 0.28, metalness: 0.9 }),
      [-w * 0.28 + i * 3.1, pcbH / 2 + 0.18, -d * 0.32],
    );
    pad.name = 'max9814-gain-pad';
    meshes.push(pad);
  }

  addPinHeader(THREE, group, meshes, {
    columns: 5,
    rows: 1,
    along: 'z',
    contact: 'male',
    heightMm: 3.2,
    pcbTopY: pcbH / 2,
    center: [-w / 2 + HEADER_PITCH_MM / 2, 0, 0],
    namePrefix: 'max9814-header',
    housingName: 'max9814-header',
  });

  return { group, meshes };
}

export const max9814Model: ModelDefinition = {
  kind: 'max9814',
  build: buildMax9814,
};
