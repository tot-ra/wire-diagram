import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import { addPinHeader, createHeaderLook, HEADER_PITCH_MM } from '../parts/pin-header.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** A4988 / DRV8825-style breakout with a proud aluminum heatsink. */
export function buildStepperDriver(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const pcbH = Math.max(h * 0.18, 1.4);

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, pcbH, d),
    new THREE.MeshStandardMaterial({ color: '#1f6b42', roughness: 0.55, metalness: 0.1 }),
  );
  pcb.name = 'stepper-driver-pcb';
  meshes.push(pcb);

  const sinkH = Math.max(h * 0.55, 4.5);
  const sink = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.42, sinkH, d * 0.55),
    new THREE.MeshStandardMaterial({ color: '#c5ccd3', roughness: 0.28, metalness: 0.88 }),
    [0, pcbH / 2 + sinkH / 2, 0],
  );
  sink.name = 'stepper-driver-heatsink';
  meshes.push(sink);

  const chip = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.28, 0.7, d * 0.32),
    new THREE.MeshStandardMaterial({ color: '#101010', roughness: 0.4, metalness: 0.2 }),
    [0, pcbH / 2 + 0.35, 0],
  );
  chip.name = 'stepper-driver-chip';
  meshes.push(chip);

  const headerLook = createHeaderLook(THREE);
  for (const zSign of [-1, 1] as const) {
    addPinHeader(THREE, group, meshes, {
      columns: 8,
      rows: 1,
      contact: 'male',
      heightMm: 2.8,
      pcbTopY: pcbH / 2,
      center: [0, 0, zSign * (d / 2 - HEADER_PITCH_MM / 2)],
      look: headerLook,
      namePrefix: 'stepper-driver-header',
      housingName: `stepper-driver-header:${zSign < 0 ? 'neg' : 'pos'}`,
    });
  }

  const pot = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(1.4, 1.4, 1.6, 12),
    new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.4, metalness: 0.5 }),
    [w * 0.32, pcbH / 2 + 0.9, 0],
  );
  pot.name = 'stepper-driver-pot';
  meshes.push(pot);

  return { group, meshes };
}

export const stepperDriverModel: ModelDefinition = {
  kind: 'stepper-driver',
  build: buildStepperDriver,
};
