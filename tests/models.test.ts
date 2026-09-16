import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  builtinModels,
  buildRegisteredModel,
  getRegisteredModel,
  registerModel,
  resolveModel,
  unregisterModel,
} from '../src/models/index.js';
import { addMesh } from '../src/models/helpers.js';
import { BUILTIN_MODEL_KINDS } from '../src/types.js';
import type { Component, ModelKind } from '../src/types.js';
import type { ModelDefinition } from '../src/models/types.js';

function sample(kind: ModelKind, extra?: Partial<Component>): Component {
  return {
    id: 'part',
    label: 'Part',
    kind,
    dimensions: [40, 10, 20],
    position: [0, 0, 0],
    quantity: 1,
    pins: [],
    ...extra,
  };
}

describe('model registry', () => {
  it('registers every built-in kind', () => {
    expect(builtinModels.map((model) => model.kind).sort()).toEqual([...BUILTIN_MODEL_KINDS].sort());
    for (const kind of BUILTIN_MODEL_KINDS) {
      expect(getRegisteredModel(kind)?.kind).toBe(kind);
    }
  });

  it('falls back to the generic board for unknown kinds', () => {
    const unknown = resolveModel('custom-cell');
    expect(unknown.kind).toBe('board');
    const built = unknown.build(THREE, sample('custom-cell'));
    expect(built.meshes.length).toBeGreaterThan(1);
  });

  it('lets a third party register a new kind', () => {
    const definition: ModelDefinition = {
      kind: 'custom-cell',
      hidePinMarkers: true,
      build(three, component) {
        const group = new three.Group();
        const box = addMesh(
          three,
          group,
          new three.BoxGeometry(...component.dimensions),
          new three.MeshStandardMaterial({ color: '#ff00aa' }),
        );
        box.name = 'custom-cell-body';
        return { group, meshes: [box] };
      },
    };

    registerModel(definition);
    try {
      expect(getRegisteredModel('custom-cell')).toBe(definition);
      const { meshes } = buildRegisteredModel(THREE, sample('custom-cell'));
      expect(meshes[0]?.name).toBe('custom-cell-body');
    } finally {
      unregisterModel('custom-cell');
    }
    expect(getRegisteredModel('custom-cell')).toBeUndefined();
  });

  it('does not install a built-in over an already registered kind', () => {
    const previous = getRegisteredModel('esp32');
    expect(previous).toBeTruthy();
    const replacement: ModelDefinition = {
      kind: 'esp32',
      build(three) {
        return { group: new three.Group(), meshes: [] };
      },
    };
    registerModel(replacement);
    try {
      // Same guard as src/models/index.ts after a lazy 3D import.
      if (!getRegisteredModel('esp32')) registerModel(previous!);
      expect(getRegisteredModel('esp32')).toBe(replacement);
    } finally {
      registerModel(previous!);
    }
  });

  it('lets widget-local models replace a built-in without touching the registry', () => {
    const extras: ModelDefinition[] = [
      {
        kind: 'esp32',
        build(three) {
          const group = new three.Group();
          const marker = addMesh(
            three,
            group,
            new three.BoxGeometry(1, 1, 1),
            new three.MeshStandardMaterial({ color: '#00ff00' }),
          );
          marker.name = 'local-esp32';
          return { group, meshes: [marker] };
        },
      },
    ];

    const { meshes } = buildRegisteredModel(THREE, sample('esp32'), extras);
    expect(meshes[0]?.name).toBe('local-esp32');
    expect(getRegisteredModel('esp32')?.kind).toBe('esp32');
    expect(buildRegisteredModel(THREE, sample('esp32')).meshes.some((mesh) => mesh.name === 'esp32-pcb')).toBe(true);
  });
});
