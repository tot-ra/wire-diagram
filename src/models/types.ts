import type { Component, Pin, Vec3 } from '../types.js';

export type ThreeModule = typeof import('three');

export interface ModelBuildResult {
  group: import('three').Group;
  meshes: import('three').Mesh[];
}

export interface PinLayoutContext {
  /** Zero-based index of this pin among pins that share the same schematic side. */
  index: number;
  count: number;
}

/**
 * A procedural 3D silhouette for one `component.kind`.
 * Third parties register their own definitions instead of forking view3d.
 */
export interface ModelDefinition {
  kind: string;
  build(THREE: ThreeModule, component: Component): ModelBuildResult;
  /** Local mm position when `pin.position` is omitted. */
  resolvePinPosition?(component: Component, pin: Pin, context: PinLayoutContext): Vec3;
  /** Skip generic yellow spheres when the mesh already includes pin geometry. */
  hidePinMarkers?: boolean;
}
