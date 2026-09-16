import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** NEMA17-style hybrid stepper. Face is YZ; shaft leaves on +X. */
export function buildStepperMotor(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;
  const bodyW = w * 0.72;
  const alongX: [number, number, number] = [0, 0, Math.PI / 2];

  const body = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(bodyW, h, d),
    new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.55, metalness: 0.35 }),
    [-w * 0.08, 0, 0],
  );
  body.name = 'stepper-motor-body';
  meshes.push(body);

  const bossR = Math.min(h, d) * 0.26;
  const boss = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(bossR, bossR, w * 0.08, 24),
    new THREE.MeshStandardMaterial({ color: '#c5ccd3', roughness: 0.3, metalness: 0.82 }),
    [w * 0.28, 0, 0],
    alongX,
  );
  boss.name = 'stepper-motor-boss';
  meshes.push(boss);

  const shaft = addMesh(
    THREE,
    group,
    new THREE.CylinderGeometry(Math.min(h, d) * 0.07, Math.min(h, d) * 0.07, w * 0.28, 16),
    new THREE.MeshStandardMaterial({ color: '#d7dee6', roughness: 0.22, metalness: 0.92 }),
    [w / 2 - w * 0.08, 0, 0],
    alongX,
  );
  shaft.name = 'stepper-motor-shaft';
  meshes.push(shaft);

  const holeR = Math.min(h, d) * 0.04;
  for (const [y, z] of [
    [h * 0.32, d * 0.32],
    [h * 0.32, -d * 0.32],
    [-h * 0.32, d * 0.32],
    [-h * 0.32, -d * 0.32],
  ] as const) {
    const hole = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(holeR, holeR, w * 0.1, 10),
      new THREE.MeshStandardMaterial({ color: '#0e1014', roughness: 0.8, metalness: 0.1 }),
      [w * 0.28, y, z],
      alongX,
    );
    hole.name = 'stepper-motor-hole';
    meshes.push(hole);
  }

  const cable = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(6, 4, 8),
    new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.7, metalness: 0.08 }),
    [-w / 2 + 2, -h * 0.12, 0],
  );
  cable.name = 'stepper-motor-cable';
  meshes.push(cable);

  return { group, meshes };
}

export const stepperMotorModel: ModelDefinition = {
  kind: 'stepper-motor',
  build: buildStepperMotor,
};
