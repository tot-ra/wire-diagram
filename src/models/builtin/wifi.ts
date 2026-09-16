import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** M.2 Key-E WiFi NIC with two IPEX nubs. */
export function buildWifi(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const pcb = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: '#1f6b42', roughness: 0.55, metalness: 0.1 }),
  );
  pcb.name = 'wifi-pcb';
  meshes.push(pcb);

  const shield = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.48, Math.max(h * 1.8, 1.6), d * 0.55),
    new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 0.28, metalness: 0.9 }),
    [w * 0.08, h / 2 + 0.6, 0],
  );
  shield.name = 'wifi-shield';
  meshes.push(shield);

  for (const z of [-d * 0.22, d * 0.22]) {
    const ipex = addMesh(
      THREE,
      group,
      new THREE.CylinderGeometry(1.1, 1.1, 2.4, 10),
      new THREE.MeshStandardMaterial({ color: '#d7c089', roughness: 0.3, metalness: 0.85 }),
      [w / 2 - 1.4, h / 2 + 1.4, z],
    );
    ipex.name = 'wifi-ipex';
    meshes.push(ipex);
  }

  return { group, meshes };
}

export const wifiModel: ModelDefinition = {
  kind: 'wifi',
  build: buildWifi,
};
