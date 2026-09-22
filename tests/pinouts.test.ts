import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { parseDiagram } from '../src/parser.js';
import { getPinout, resolvePhysicalPinNumber } from '../src/pinouts.js';
import { buildRegisteredModel, localPinPosition } from '../src/models/index.js';
import { renderSVG } from '../src/svg.js';

function documentFor(kind = 'raspberry-pi', pins: object[] = [], wires: object[] = [], extra: object = {}) {
  return { version: 1, title: 'Pinout test', components: [{ id: 'board', label: 'Board', kind, pins, ...extra }], wires };
}
const wire = (from: string, to: string, id = 'wire') => ({ id, from: `board.${from}`, to: `board.${to}` });

describe('numbered pin graph', () => {
  it('creates only used pins and canonicalizes physical, numeric and GPIO references', () => {
    const diagram = parseDiagram(documentFor('raspberry-pi', [], [wire('7', 'GPIO4'), wire('BCM4', 'PIN7', 'other')]));
    expect(diagram.components[0].pins).toEqual([{ id: 'PIN7', number: 7, gpio: 4, label: 'GPIO4', side: 'left' }]);
    for (const entry of diagram.wires) expect([entry.from, entry.to]).toEqual(['board.PIN7', 'board.PIN7']);
    expect(parseDiagram(diagram)).toEqual(diagram);
    expect(renderSVG(diagram)).toContain('Pin 7 / GPIO4');
  });

  it('supports stable named endpoints with explicit number and/or GPIO', () => {
    const diagram = parseDiagram(documentFor('esp32', [{ id: 'data', number: 27, gpio: 16 }], [wire('GPIO16', '27')]));
    expect(diagram.wires[0].from).toBe('board.data');
    expect(diagram.wires[0].to).toBe('board.data');
    expect(diagram.components[0].pins[0]).toMatchObject({ id: 'data', number: 27, gpio: 16 });
  });

  it('rejects contradictory named rails/signals but allows another equivalent ground contact', () => {
    for (const [kind, pin] of [['esp32', { id: 'VIN', number: 1 }], ['esp32', { id: '3V3', number: 19 }],
      ['raspberry-pi', { id: 'SDA', number: 5 }]] as const) {
      expect(() => parseDiagram(documentFor(kind, [pin]))).toThrow(/Conflicting/);
    }
    const d = parseDiagram(documentFor('raspberry-pi', [{ id: 'GND', number: 9 }], [wire('GND', 'PIN9')]));
    expect(d.wires[0].from).toBe(d.wires[0].to);
    expect(parseDiagram(d)).toEqual(d);
  });

  it('keeps repeated grounds distinct by number', () => {
    const diagram = parseDiagram(documentFor('raspberry-pi', [], [wire('6', '9')]));
    expect(diagram.components[0].pins.map(p => p.number)).toEqual([6, 9]);
    expect(diagram.wires[0].from).not.toBe(diagram.wires[0].to);
  });

  it.each([
    [{ id: 'signal', number: 7, gpio: 17 }], [{ id: 'PIN8', number: 7 }], [{ id: 'GPIO17', gpio: 4 }],
    [{ id: 'signal', number: 41 }], [{ id: 'signal', gpio: 99 }], [{ id: 'PIN41' }], [{ id: 'GPIO99' }],
    [{ id: 'PIN7' }, { id: 'GPIO4' }], [{ id: 'signal', number: 0 }], [{ id: 'signal', gpio: -1 }],
    [{ id: 'signal', number: 7.1 }],
  ])('rejects invalid/conflicting/duplicate pins: %j', (...pins) => {
    expect(() => parseDiagram(documentFor('raspberry-pi', pins))).toThrow();
  });

  it.each(['PIN0', 'PIN41', 'GPIO99', '7.5'])('rejects invalid auto endpoint %s', ref => {
    expect(() => parseDiagram(documentFor('raspberry-pi', [], [wire(ref, '7')]))).toThrow();
  });

  it('uses the Pico pin map rather than the Pi BCM map, including GPIO0 and GPIO28', () => {
    const diagram = parseDiagram(documentFor('raspberry-pi', [], [wire('GPIO0', 'GP28')], { properties: { variant: 'pico' } }));
    expect(diagram.components[0].pins.map(pin => pin.number)).toEqual([1, 34]);
    expect(diagram.components[0].dimensions).toEqual([51, 3, 21]);
  });

  it.each(['jetson-nano', 'jetson-orin-nano'])('uses Jetson.GPIO BCM numbering for %s, not Tegra line numbers', kind => {
    const diagram = parseDiagram(documentFor(kind, [], [wire('GPIO4', 'PIN7')]));
    expect(diagram.wires[0].from).toBe(diagram.wires[0].to);
    expect(getPinout(diagram.components[0])?.gpioScheme).toBe('BCM');
    expect(() => parseDiagram(documentFor(kind, [], [wire('GPIO144', 'PIN7')]))).toThrow();
    expect(() => parseDiagram(documentFor(kind, [], [wire('GPIO2', 'PIN3')]))).toThrow();
    const ports = parseDiagram(documentFor(kind, [{ id: 'VIN' }, { id: 'USB-C' }]));
    expect(ports.components[0].pins.every(pin => pin.number === undefined)).toBe(true);
  });

  it('rejects a profile incompatible with a builtin board variant', () => {
    expect(() => parseDiagram(documentFor('raspberry-pi', [], [], { pinout: 'raspberry-pi-pico' }))).toThrow(/does not match/);
  });

  it('allows explicit positions for custom numbered contacts but never invents a custom layout', () => {
    expect(() => parseDiagram(documentFor('custom-board', [{ id: 'data', number: 7 }]))).toThrow(/position/);
    const diagram = parseDiagram(documentFor('custom-board', [{ id: 'data', number: 7, gpio: 4, position: [1, 2, 3] }], [wire('7', 'GPIO4')]));
    expect(diagram.wires[0].from).toBe('board.data');
    expect(localPinPosition(diagram.components[0], diagram.components[0].pins[0])).toEqual([1, 2, 3]);
  });

  it('allows host models to opt into a pinout without adding a global registry dependency to parsing', () => {
    const diagram = parseDiagram(documentFor('custom-carrier', [], [wire('7', 'GPIO4')], { pinout: 'jetson-nano' }));
    const component = diagram.components[0];
    expect(component.pins[0].number).toBe(7);
    expect(localPinPosition(component, component.pins[0], [{ kind: 'custom-carrier',
      build: () => ({ group: new THREE.Group(), meshes: [] }),
      resolvePinPosition: (_c, p) => [p.number!, 20, 30],
    }])).toEqual([7, 20, 30]);
  });

  it('keeps explicit anchor overrides and schematic sides independent of physical numbering', () => {
    const diagram = parseDiagram(documentFor('raspberry-pi', [{ id: 'GPIO4', side: 'right', position: [1, 2, 3] }]));
    const c = diagram.components[0];
    expect(c.pins[0].side).toBe('right');
    expect(localPinPosition(c, c.pins[0])).toEqual([1, 2, 3]);
  });
});

describe('physical contact geometry', () => {
  it.each([
    ['esp32', undefined], ['raspberry-pi', '4'], ['raspberry-pi', '5'], ['raspberry-pi', 'zero'],
    ['raspberry-pi', 'pico'], ['jetson-nano', undefined], ['jetson-orin-nano', undefined],
  ])('every numbered %s/%s anchor touches a modeled contact, including boundary pins', (kind, variant) => {
    const c = parseDiagram(documentFor(kind, [], [], variant ? { properties: { variant } } : {})).components[0];
    const profile = getPinout(c)!;
    const model = buildRegisteredModel(THREE, c);
    for (const contact of profile.contacts) {
      const pin = { id: `PIN${contact.number}`, number: contact.number, side: 'right' as const };
      const local = localPinPosition(c, pin);
      const match = model.meshes.find(mesh => {
        if (!(mesh.geometry instanceof THREE.BoxGeometry) || !mesh.name.includes('pin')) return false;
        const top = mesh.position.y + mesh.geometry.parameters.height / 2;
        return Math.abs(mesh.position.x - local[0]) < 0.001 && Math.abs(top - local[1]) < 0.001
          && Math.abs(mesh.position.z - local[2]) < 0.001;
      });
      expect(match, `${profile.id} PIN${contact.number} must touch a contact`).toBeTruthy();
      if (contact.gpio !== undefined) {
        expect(resolvePhysicalPinNumber(c, { id: `GPIO${contact.gpio}` })).toBe(contact.number);
        expect(localPinPosition(c, { id: `GPIO${contact.gpio}`, side: 'left' })).toEqual(local);
      }
    }
  });

  it('pin subset, order and schematic side never move the selected physical contact', () => {
    for (const kind of ['esp32', 'raspberry-pi', 'jetson-nano', 'jetson-orin-nano']) {
      const alone = parseDiagram(documentFor(kind, [{ id: 'GPIO4' }])).components[0];
      const reordered = parseDiagram(documentFor(kind, [{ id: 'GND' }, { id: 'GPIO4', side: 'right' }])).components[0];
      expect(localPinPosition(alone, alone.pins[0])).toEqual(localPinPosition(reordered, reordered.pins[1]));
    }
  });
});


it('parses and round-trips both the numbered four-board example and migrated beehive wiring', () => {
  for (const file of ['numbered-pins.yaml', 'beehive.yaml']) {
    const diagram = parseDiagram(readFileSync(resolve(import.meta.dirname, '../examples', file), 'utf8'));
    expect(diagram.wires.length).toBeGreaterThan(0);
    expect(parseDiagram(diagram)).toEqual(diagram);
    const esp = diagram.components.find(c => c.kind === 'esp32')!;
    expect(esp.pins.some(pin => pin.gpio === 16 && pin.number === 27)).toBe(true);
    expect(esp.pins.every(pin => pin.position === undefined)).toBe(true);
  }
});
