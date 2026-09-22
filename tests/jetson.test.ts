import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildJetsonNano,
  buildJetsonOrinNano,
  getRegisteredModel,
  jetsonPinTipY,
  resolveJetsonPinPosition,
} from '../src/models/index.js';
import { resolvePhysicalPinNumber } from '../src/pinouts.js';
import type { Component } from '../src/types.js';

function box(mesh: import('three').Mesh): THREE.BoxGeometry {
  expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
  return mesh.geometry as THREE.BoxGeometry;
}

function pinTop(mesh: import('three').Mesh): number {
  return mesh.position.y + box(mesh).parameters.height / 2;
}

function sample(kind: 'jetson-nano' | 'jetson-orin-nano'): Component {
  const dimensions =
    kind === 'jetson-nano'
      ? ([100, 18, 80] as [number, number, number])
      : ([100, 18, 79] as [number, number, number]);
  return {
    id: kind,
    label: kind,
    kind,
    dimensions,
    position: [0, 0, 0],
    quantity: 1,
    pins: [],
  };
}

function expectAnchorMatchesPin(
  component: Component,
  prefix: string,
  pinId: string,
  row: number,
  column: number,
): void {
  const meshes =
    component.kind === 'jetson-nano'
      ? buildJetsonNano(THREE, component).meshes
      : buildJetsonOrinNano(THREE, component).meshes;
  const pinMesh = meshes.find((mesh) => mesh.name === `${prefix}-gpio-pin:${row}:${column}`);
  expect(pinMesh).toBeTruthy();
  const anchor = resolveJetsonPinPosition(
    component,
    { id: pinId, side: 'left' },
    { index: column, count: 20 },
  );
  expect(anchor[0]).toBeCloseTo(pinMesh!.position.x);
  expect(anchor[2]).toBeCloseTo(pinMesh!.position.z);
  expect(anchor[1]).toBeCloseTo(pinTop(pinMesh!));
  expect(anchor[1]).toBeCloseTo(jetsonPinTipY());
}

describe('jetson carrier models', () => {
  it('registers distinct jetson-nano and jetson-orin-nano kinds', () => {
    expect(getRegisteredModel('jetson-nano')?.hidePinMarkers).toBe(true);
    expect(getRegisteredModel('jetson-orin-nano')?.hidePinMarkers).toBe(true);
    expect(getRegisteredModel('jetson-nano')?.kind).not.toBe(getRegisteredModel('jetson-orin-nano')?.kind);
  });

  it('builds a Jetson Nano carrier with heatsink, barrel jack, and 40-pin male header', () => {
    const component = sample('jetson-nano');
    const { meshes } = buildJetsonNano(THREE, component);
    expect(meshes.find((mesh) => mesh.name === 'jetson-nano-pcb')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-nano-heatsink-base')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-nano-fan-housing')).toBeFalsy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-nano-power')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-nano-hdmi')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-nano-usbc')).toBeFalsy();
    expect(meshes.filter((mesh) => mesh.name.startsWith('jetson-nano-gpio-pin:'))).toHaveLength(40);
    const housing = meshes.find((mesh) => mesh.name === 'jetson-nano-gpio')!;
    const pin = meshes.find((mesh) => mesh.name === 'jetson-nano-gpio-pin:1:0')!;
    const housingTop = housing.position.y + box(housing).parameters.height / 2;
    expect(pinTop(pin)).toBeGreaterThan(housingTop);
  });

  it('builds a Jetson Nano carrier with two stacked USB-A pairs (four ports)', () => {
    const component = sample('jetson-nano');
    const { meshes } = buildJetsonNano(THREE, component);
    expect(meshes.find((mesh) => mesh.name === 'jetson-nano-usb:0')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-nano-usb:2')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-nano-usb:1')).toBeFalsy();
    expect(meshes.filter((mesh) => mesh.name.startsWith('jetson-nano-usb:') && mesh.userData?.kind === 'usb-a')).toHaveLength(2);
    expect(meshes.filter((mesh) => mesh.name.startsWith('jetson-nano-usb:') && mesh.userData?.stacked === true)).toHaveLength(2);
  });

  it('builds a Jetson Orin Nano carrier with DC barrel power, data USB-C, fan, and stacked USB-A', () => {
    const component = sample('jetson-orin-nano');
    const { meshes } = buildJetsonOrinNano(THREE, component);
    expect(meshes.find((mesh) => mesh.name === 'jetson-orin-nano-pcb')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-orin-nano-fan-housing')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-orin-nano-heatsink-base')).toBeFalsy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-orin-nano-power')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-orin-nano-usbc')).toBeTruthy();
    expect(meshes.find((mesh) => mesh.name === 'jetson-orin-nano-dp')).toBeTruthy();
    expect(meshes.filter((mesh) => mesh.name.startsWith('jetson-orin-nano-gpio-pin:'))).toHaveLength(40);
    expect(meshes.filter((mesh) => mesh.name.startsWith('jetson-orin-nano-usb:') && mesh.userData?.stacked === true)).toHaveLength(2);
    const housing = meshes.find((mesh) => mesh.name === 'jetson-orin-nano-fan-housing')!;
    const blade = meshes.find((mesh) => mesh.name === 'jetson-orin-nano-fan-blade:0')!;
    const housingTop = housing.position.y + box(housing).parameters.height / 2;
    expect(blade.position.y).toBeGreaterThan(housingTop + 0.5);
    expect(meshes.find((mesh) => mesh.name === 'jetson-orin-nano-fan-grille')).toBeFalsy();
    expect(meshes.filter((mesh) => mesh.name.startsWith('jetson-orin-nano-fan-grille:'))).toHaveLength(2);
  });

  it('lands numbered and GPIO pins on gold contact tops for Jetson Nano', () => {
    const component = sample('jetson-nano');
    expectAnchorMatchesPin(component, 'jetson-nano', 'PIN1', 1, 0);
    expectAnchorMatchesPin(component, 'jetson-nano', 'PIN3', 1, 1);
    expectAnchorMatchesPin(component, 'jetson-nano', 'GPIO2', 1, 1);
    expectAnchorMatchesPin(component, 'jetson-nano', 'SDA', 1, 1);
  });

  it('lands numbered and GPIO pins on gold contact tops for Jetson Orin Nano', () => {
    const component = sample('jetson-orin-nano');
    expect(resolvePhysicalPinNumber(component, { id: 'PIN5', side: 'left' })).toBe(5);
    expect(resolvePhysicalPinNumber(component, { id: 'GPIO4', side: 'left' })).toBe(7);
    expect(resolvePhysicalPinNumber(component, { id: 'PIN39', side: 'left' })).toBe(39);
    expect(resolvePhysicalPinNumber(component, { id: 'PIN40', side: 'right' })).toBe(40);
    expectAnchorMatchesPin(component, 'jetson-orin-nano', 'PIN1', 1, 0);
    expectAnchorMatchesPin(component, 'jetson-orin-nano', 'PIN5', 1, 2);
    expectAnchorMatchesPin(component, 'jetson-orin-nano', 'GPIO4', 1, 3);
    expectAnchorMatchesPin(component, 'jetson-orin-nano', 'SCL', 1, 2);
    expectAnchorMatchesPin(component, 'jetson-orin-nano', 'PIN39', 1, 19);
    expectAnchorMatchesPin(component, 'jetson-orin-nano', 'PIN40', 0, 19);
  });

  it('maps Orin port aliases to barrel power and data-only USB-C', () => {
    const component = sample('jetson-orin-nano');
    const power = resolveJetsonPinPosition(component, { id: 'POWER', side: 'left' }, { index: 0, count: 1 });
    const barrel = resolveJetsonPinPosition(component, { id: 'BARREL', side: 'left' }, { index: 0, count: 1 });
    const vin = resolveJetsonPinPosition(component, { id: 'VIN', side: 'left' }, { index: 0, count: 1 });
    const usbc = resolveJetsonPinPosition(component, { id: 'USBC', side: 'left' }, { index: 0, count: 1 });
    expect(power).toEqual(barrel);
    expect(power).toEqual(vin);
    expect(usbc[0]).toBeCloseTo(power[0]);
    expect(Math.abs(usbc[2] - power[2])).toBeGreaterThan(5);
    expect(resolveJetsonPinPosition(component, { id: 'PD', side: 'left' }, { index: 0, count: 1 })).not.toEqual(usbc);
  });

  it('lands boundary header pins for Jetson Nano', () => {
    const component = sample('jetson-nano');
    expect(resolvePhysicalPinNumber(component, { id: 'PIN39', side: 'left' })).toBe(39);
    expect(resolvePhysicalPinNumber(component, { id: 'PIN40', side: 'right' })).toBe(40);
    expectAnchorMatchesPin(component, 'jetson-nano', 'PIN39', 1, 19);
    expectAnchorMatchesPin(component, 'jetson-nano', 'PIN40', 0, 19);
  });
});
