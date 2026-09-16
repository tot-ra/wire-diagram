import type { Vec3 } from '../types.js';
import type { ThreeModule } from './types.js';

export function cssColor(THREE: ThreeModule, value: string, fallback = '#888888'): import('three').Color {
  try {
    return new THREE.Color(value);
  } catch {
    return new THREE.Color(fallback);
  }
}

export function addMesh(
  THREE: ThreeModule,
  group: import('three').Group,
  geometry: import('three').BufferGeometry,
  material: import('three').Material,
  position?: Vec3,
  rotation?: Vec3,
): import('three').Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (position) mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  group.add(mesh);
  return mesh;
}
