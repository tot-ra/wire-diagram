import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DiagramParseError, getBom, parseDiagram } from '../src/parser.js';

const minimalYaml = `
version: 1
title: Test bench
components:
  - id: board-a
    label: Board A
    pins:
      - id: VCC
      - id: GND
        side: right
wires:
  - id: w1
    from: board-a.VCC
    to: board-a.GND
`;

describe('parseDiagram', () => {
  it('parses YAML with defaults', () => {
    const diagram = parseDiagram(minimalYaml);
    expect(diagram.version).toBe(1);
    expect(diagram.groups).toEqual([]);
    expect(diagram.notes).toEqual([]);
    expect(diagram.components[0].kind).toBe('board');
    expect(diagram.components[0].dimensions).toEqual([40, 3, 25]);
    expect(diagram.components[0].quantity).toBe(1);
    expect(diagram.components[0].position).toEqual([0, 0, 0]);
    expect(diagram.components[0].pins[0].side).toBe('left');
    expect(diagram.wires[0].color).toBe('#475569');
  });

  it('accepts plain objects', () => {
    const diagram = parseDiagram({
      version: 1,
      title: 'Obj',
      components: [{ id: 'r1', label: 'R1', pins: [{ id: 'E+' }, { id: 'E-' }] }],
      wires: [],
    });
    expect(diagram.components[0].pins.map((p) => p.id)).toEqual(['E+', 'E-']);
  });

  it('rejects non-version-1 documents', () => {
    expect(() =>
      parseDiagram({ version: 2, title: 'x', components: [], wires: [] }),
    ).toThrow(DiagramParseError);
  });

  it('rejects duplicate ids across components and wires', () => {
    expect(() =>
      parseDiagram({
        version: 1,
        title: 'dup',
        components: [{ id: 'same', label: 'A', pins: [] }],
        wires: [{ id: 'same', from: 'a.p1', to: 'a.p2' }],
      }),
    ).toThrow(/Duplicate id/);
  });

  it('rejects duplicate pin ids', () => {
    expect(() =>
      parseDiagram({
        version: 1,
        title: 'dup pin',
        components: [{ id: 'c1', label: 'C', pins: [{ id: 'p1' }, { id: 'p1' }] }],
        wires: [],
      }),
    ).toThrow(/Duplicate pin id/);
  });

  it('rejects unknown group references', () => {
    expect(() =>
      parseDiagram({
        version: 1,
        title: 'group',
        groups: [],
        components: [{ id: 'c1', label: 'C', group: 'missing', pins: [] }],
        wires: [],
      }),
    ).toThrow(/Unknown group/);
  });

  it('rejects unknown wire endpoints', () => {
    expect(() =>
      parseDiagram({
        version: 1,
        title: 'wire',
        components: [{ id: 'c1', label: 'C', pins: [{ id: 'p1' }] }],
        wires: [{ id: 'w1', from: 'c1.p1', to: 'c1.missing' }],
      }),
    ).toThrow(/Unknown pin/);
  });

  it('rejects component ids containing dots', () => {
    expect(() =>
      parseDiagram({
        version: 1,
        title: 'bad id',
        components: [{ id: 'bad.id', label: 'X', pins: [] }],
        wires: [],
      }),
    ).toThrow(/dots/);
  });

  it('rejects non-positive dimensions', () => {
    expect(() =>
      parseDiagram({
        version: 1,
        title: 'dim',
        components: [{ id: 'c1', label: 'C', dimensions: [0, 3, 25], pins: [] }],
        wires: [],
      }),
    ).toThrow(DiagramParseError);
  });

  it('rejects unsafe purchase URLs', () => {
    expect(() =>
      parseDiagram({
        version: 1,
        title: 'purchase',
        components: [
          {
            id: 'c1',
            label: 'C',
            pins: [],
            purchase: { url: 'javascript:alert(1)' },
          },
        ],
        wires: [],
      }),
    ).toThrow(/http/);
  });

  it('rejects unsafe model URLs', () => {
    expect(() =>
      parseDiagram({
        version: 1,
        title: 'model',
        components: [
          {
            id: 'c1',
            label: 'C',
            pins: [],
            model: { url: 'data:application/octet-stream;base64,abc', scale: 1 },
          },
        ],
        wires: [],
      }),
    ).toThrow(/Model URL/);
  });

  it('allows safe relative model URLs', () => {
    const diagram = parseDiagram({
      version: 1,
      title: 'model',
      components: [
        {
          id: 'c1',
          label: 'C',
          pins: [],
          model: { url: './models/board.glb', scale: 1.2 },
        },
      ],
      wires: [],
    });
    expect(diagram.components[0].model?.url).toBe('./models/board.glb');
  });

  it('rejects model URLs with backslashes', () => {
    expect(() =>
      parseDiagram({
        version: 1,
        title: 'model',
        components: [
          {
            id: 'c1',
            label: 'C',
            pins: [],
            model: { url: 'models\\evil.glb', scale: 1 },
          },
        ],
        wires: [],
      }),
    ).toThrow(/Model URL/);
  });

  it('bounds YAML alias expansion', () => {
    const refs = Array.from({ length: 100 }, (_, i) => `extra${i}: *node`).join('\n');
    const yaml = `version: 1\ntitle: aliases\ncomponents: []\nwires: []\nnode: &node [1]\n${refs}`;
    expect(() => parseDiagram(yaml)).toThrow(/alias/i);
  });
});

describe('getBom', () => {
  it('returns component-derived lines', () => {
    const diagram = parseDiagram({
      version: 1,
      title: 'bom',
      components: [
        {
          id: 'hx',
          label: 'Load amp',
          kind: 'hx711',
          quantity: 2,
          purchase: { url: 'https://example.com/part', partNumber: 'HX711', label: 'Shop' },
          pins: [],
        },
      ],
      wires: [],
    });
    expect(getBom(diagram)).toEqual([
      {
        componentId: 'hx',
        label: 'Load amp',
        kind: 'hx711',
        quantity: 2,
        partNumber: 'HX711',
        purchaseUrl: 'https://example.com/part',
        purchaseLabel: 'Shop',
        group: undefined,
      },
    ]);
  });
});

it('accepts product kebab-case kinds that are not library builtins', () => {
  const diagram = parseDiagram({
    version: 1,
    title: 'lab',
    components: [
      { id: 'jetson', label: 'Jetson', kind: 'jetson', pins: [{ id: 'USBC' }] },
      { id: 'cam', label: 'Camera', kind: 'camera', pins: [{ id: 'USB' }] },
    ],
    wires: [{ id: 'u', from: 'cam.USB', to: 'jetson.USBC' }],
  });
  expect(diagram.components.map((c) => c.kind)).toEqual(['jetson', 'camera']);
});

it('accepts catalog sensor, Pi, connector and motion kinds', () => {
  const diagram = parseDiagram({
    version: 1,
    title: 'catalog',
    components: [
      { id: 'mic', label: 'Mic', kind: 'max4466', pins: [{ id: 'OUT' }] },
      { id: 'pi', label: 'Pi 5', kind: 'raspberry-pi', properties: { variant: '5' }, pins: [{ id: 'GPIO' }] },
      { id: 'uno', label: 'UNO', kind: 'arduino-uno', pins: [{ id: 'D13' }] },
      { id: 'jack', label: 'Jack', kind: 'barrel-jack', pins: [{ id: 'VCC' }] },
      { id: 'motor', label: 'Stepper', kind: 'stepper-motor', pins: [{ id: 'A1' }] },
    ],
    wires: [],
  });
  expect(diagram.components.map((c) => c.kind)).toEqual([
    'max4466',
    'raspberry-pi',
    'arduino-uno',
    'barrel-jack',
    'stepper-motor',
  ]);
});

it('accepts third-party kebab-case kinds', () => {
  const diagram = parseDiagram({
    version: 1,
    title: 'custom',
    components: [{ id: 'cell', label: 'Cell', kind: 'custom-cell', pins: [{ id: 'SIG' }] }],
    wires: [],
  });
  expect(diagram.components[0].kind).toBe('custom-cell');
});

it('rejects kinds that are not lowercase kebab-case', () => {
  expect(() =>
    parseDiagram({
      version: 1,
      title: 'bad kind',
      components: [{ id: 'cell', label: 'Cell', kind: 'CustomCell', pins: [] }],
      wires: [],
    }),
  ).toThrow(/kebab-case/);
});

it('parses the 3D model gallery demo', () => {
  const source = readFileSync(resolve(import.meta.dirname, '../examples/showcase.yaml'), 'utf8');
  const diagram = parseDiagram(source);
  expect(diagram.components).toHaveLength(25);
  expect(diagram.components.map((c) => c.kind)).toEqual(
    expect.arrayContaining([
      'max4466',
      'max9814',
      'ds18b20',
      'lcd1602',
      'lcd2004',
      'raspberry-pi',
      'jetson-nano',
      'jetson-orin-nano',
      'arduino-uno',
      'barrel-jack',
      'jst-connector',
      'stepper-motor',
      'stepper-driver',
      'led',
      'status-led',
    ]),
  );
  expect(diagram.components.filter((c) => c.kind === 'raspberry-pi')).toHaveLength(4);
  expect(diagram.components.filter((c) => c.kind === 'arduino-uno')).toHaveLength(1);
});

it('rejects misspelled fields, dotted pins and unsafe paint values', () => {
  expect(() => parseDiagram({version:1,title:'x',wire:[]})).toThrow();
  expect(() => parseDiagram({version:1,title:'x',components:[{id:'a',label:'A',pins:[{id:'p.q'}]}]})).toThrow();
  expect(() => parseDiagram({version:1,title:'x',groups:[{id:'a',label:'A',color:'url(https://example.com/paint.svg#x)'}]})).toThrow();
});
