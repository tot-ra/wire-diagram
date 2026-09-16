import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import { addPinHeader, HEADER_PITCH_MM } from '../parts/pin-header.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** AliExpress / Adafruit-style MAX4466 electret amp: small PCB, can mic, gain trimmer. */
export function buildMax4466(
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
    new THREE.MeshStandardMaterial({ color: '#1f6b42', roughness: 0.55, metalness: 0.1 }),
  );
  pcb.name = 'max4466-pcb';
  meshes.push(pcb);

  const micR = Math.min(d, w) * 0.22;
  const micH = Math.max(h * 0.9, 4.2);
  const mic = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(micR, micR, micH, 20),
    new THREE.MeshStandardMaterial({ color: '#c5ccd3', roughness: 0.32, metalness: 0.88 }),
    [w * 0.28, pcbH / 2 + micH / 2, 0],
  );
  mic.name = 'max4466-mic';
  meshes.push(mic);

  const grill = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(micR * 0.72, micR * 0.72, 0.4, 16),
    new THREE.MeshStandardMaterial({ color: '#2a2d32', roughness: 0.55, metalness: 0.4 }),
    [w * 0.28, pcbH / 2 + micH + 0.15, 0],
  );
  grill.name = 'max4466-grill';
  meshes.push(grill);

  const trimH = Math.max(h * 0.45, 2.2);
  const trim = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(d * 0.16, d * 0.16, trimH, 12),
    new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.4, metalness: 0.55 }),
    [-w * 0.22, pcbH / 2 + trimH / 2, d * 0.12],
  );
  trim.name = 'max4466-trimmer';
  meshes.push(trim);

  const chip = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.22, 0.7, d * 0.28),
    new THREE.MeshStandardMaterial({ color: '#121212', roughness: 0.4, metalness: 0.2 }),
    [-w * 0.08, pcbH / 2 + 0.35, -d * 0.12],
  );
  chip.name = 'max4466-chip';
  meshes.push(chip);

  addPinHeader(THREE, group, meshes, {
    columns: 3,
    rows: 1,
    along: 'z',
    contact: 'male',
    heightMm: 3.2,
    pcbTopY: pcbH / 2,
    center: [-w / 2 + HEADER_PITCH_MM / 2, 0, 0],
    namePrefix: 'max4466-header',
    housingName: 'max4466-header',
  });

  return { group, meshes };
}

export const max4466Model: ModelDefinition = {
  kind: 'max4466',
  build: buildMax4466,
};
