import type { Component } from '../types.js';
import type { ModelBuildResult, ModelDefinition, ThreeModule } from './types.js';

const models = new Map<string, ModelDefinition>();
let fallback: ModelDefinition | undefined;

/** Last-write-wins so HMR and third-party packs can replace a built-in silhouette. */
export function registerModel(definition: ModelDefinition): void {
  if (!definition.kind) {
    throw new Error('Model definition requires a kind');
  }
  models.set(definition.kind, definition);
}

export function unregisterModel(kind: string): void {
  models.delete(kind);
}

export function getRegisteredModel(kind: string): ModelDefinition | undefined {
  return models.get(kind);
}

export function setFallbackModel(definition: ModelDefinition): void {
  fallback = definition;
}

/**
 * Widget-local models win over the global registry so one page can host
 * two diagrams with different packs without unregistering globals.
 */
export function lookupModel(kind: string, extras?: readonly ModelDefinition[]): ModelDefinition | undefined {
  return extras?.find((entry) => entry.kind === kind) ?? models.get(kind) ?? fallback;
}

export function resolveModel(kind: string, extras?: readonly ModelDefinition[]): ModelDefinition {
  return lookupModel(kind, extras) ?? missingModel(kind);
}

export function buildRegisteredModel(
  THREE: ThreeModule,
  component: Component,
  extras?: readonly ModelDefinition[],
): ModelBuildResult {
  return resolveModel(component.kind, extras).build(THREE, component);
}

function missingModel(kind: string): ModelDefinition {
  throw new Error(`No 3D model registered for kind "${kind}" and no fallback model is installed`);
}
