import type { Component, Pin, Vec3 } from '../types.js';
import { lookupModel } from './registry.js';
import type { ModelDefinition } from './types.js';

export function pinsBySide(component: Component): { left: Pin[]; right: Pin[] } {
  const left: Pin[] = [];
  const right: Pin[] = [];
  for (const pin of component.pins) {
    if (pin.side === 'left') left.push(pin);
    else right.push(pin);
  }
  return { left, right };
}

export function pinIndexOnSide(component: Component, pin: Pin): { index: number; count: number } {
  const grouped = pinsBySide(component);
  const list = pin.side === 'left' ? grouped.left : grouped.right;
  const index = list.findIndex((entry) => entry.id === pin.id);
  return { index: Math.max(index, 0), count: list.length };
}

export function defaultPinLocalPosition(
  component: Component,
  pin: Pin,
  pinIndex: number,
  pinsOnSide: number,
): Vec3 {
  const [width, height, depth] = component.dimensions;
  const edgeX = pin.side === 'left' ? -width / 2 : width / 2;
  const slot = pinIndex + 1;
  const slots = Math.max(pinsOnSide, 1) + 1;
  const z = depth * (slot / slots - 0.5);
  const y = height * 0.08;
  return [edgeX, y, z];
}

export function localPinPosition(
  component: Component,
  pin: Pin,
  extras?: readonly ModelDefinition[],
): Vec3 {
  if (pin.position) return pin.position;
  const { index, count } = pinIndexOnSide(component, pin);
  const model = lookupModel(component.kind, extras);
  if (model?.resolvePinPosition) {
    return model.resolvePinPosition(component, pin, { index, count });
  }
  return defaultPinLocalPosition(component, pin, index, count);
}
