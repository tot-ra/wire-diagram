import type { Component } from '../../types.js';
import { addMesh } from '../helpers.js';
import type { ModelDefinition, ThreeModule } from '../types.js';

/** 7 inch HDMI panel standing on Y, screen recessed on +Z so it does not z-fight the bezel. */
export function buildDisplay(
  THREE: ThreeModule,
  component: Component,
): { group: import('three').Group; meshes: import('three').Mesh[] } {
  const group = new THREE.Group();
  const meshes: import('three').Mesh[] = [];
  const [w, h, d] = component.dimensions;

  const bezel = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.6, metalness: 0.15 }),
  );
  bezel.name = 'display-bezel';
  meshes.push(bezel);

  const screenT = Math.max(d * 0.28, 1.2);
  const screen = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(w * 0.9, h * 0.86, screenT),
    new THREE.MeshStandardMaterial({
      color: '#2b4c78',
      roughness: 0.18,
      metalness: 0.12,
      emissive: '#163152',
      emissiveIntensity: 0.35,
    }),
    [0, 0, d / 2 - screenT * 0.35],
  );
  screen.name = 'display-screen';
  meshes.push(screen);

  const hdmi = addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(8, 3.2, Math.min(d, 8)),
    new THREE.MeshStandardMaterial({ color: '#8d6e2f', roughness: 0.4, metalness: 0.55 }),
    [-w / 2 + 4, -h / 2 + 4, 0],
  );
  hdmi.name = 'display-hdmi';
  meshes.push(hdmi);

  return { group, meshes };
}

export const displayModel: ModelDefinition = {
  kind: 'display',
  build: buildDisplay,
};
