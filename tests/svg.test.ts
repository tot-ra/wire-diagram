// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseDiagram } from '../src/parser.js';
import { createSVGView, escapeXml, renderSVG } from '../src/svg.js';

const sample = parseDiagram({
  version: 1,
  title: 'Schematic <demo> & "wiring"',
  groups: [{ id: 'power', label: 'Power <rail>', color: '#f59e0b' }],
  components: [
    {
      id: 'src',
      label: 'Source & <unit>',
      group: 'power',
      schematic: [40, 60],
      pins: [
        { id: 'OUT', label: '5V <out>', side: 'right' },
        { id: 'GND', side: 'left' },
      ],
    },
    {
      id: 'load',
      label: 'Load',
      schematic: [360, 60],
      pins: [
        { id: 'IN', side: 'left' },
        { id: 'GND', side: 'left' },
      ],
    },
  ],
  wires: [
    { id: 'vcc', from: 'src.OUT', to: 'load.IN', color: '#dc2626', label: 'V+ <line>' },
    { id: 'gnd', from: 'src.GND', to: 'load.GND', dashed: true, color: '#475569' },
  ],
});

describe('escapeXml', () => {
  it('escapes unsafe characters', () => {
    expect(escapeXml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
  });
});

describe('renderSVG', () => {
  it('renders component labels and pin endpoints', () => {
    const svg = renderSVG(sample);
    expect(svg).toContain('Source &amp; &lt;unit&gt;');
    expect(svg).toContain('5V &lt;out&gt;');
    expect(svg).toContain('data-group="power"');
    expect(svg).toContain('stroke="#dc2626"');
    expect(svg).toContain('stroke-dasharray="8 6"');
    expect(svg).toContain('V+ &lt;line&gt;');
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('javascript:');
  });

  it('keeps pin labels inside boxes and dots on edges', () => {
    const svg = renderSVG(sample);
    expect(svg).toContain('cx="270" cy="122"');
    expect(svg).toContain('x="260" y="126" text-anchor="end"');
    expect(svg).toContain('x="50" y="126" text-anchor="start"');
  });

  it('routes wires from pin edges with detours for same-side links', () => {
    const svg = renderSVG(sample);
    expect(svg).toContain('M 270 122 H 286 H 344 H 360');
    expect(svg).toContain('M 40 122 H 24 V 200 H 344 V 146 H 360');
    expect(svg).not.toContain('stroke="#ffffff"');
  });

  it('includes negative origin in viewBox when content uses negative coords', () => {
    const negative = parseDiagram({
      version: 1,
      title: 'Negative layout',
      components: [
        {
          id: 'a',
          label: 'A',
          schematic: [-120, -40],
          pins: [{ id: 'p', side: 'right' }],
        },
      ],
      wires: [],
    });
    const svg = renderSVG(negative);
    expect(svg).toContain('viewBox="-160 -80');
  });

  it('renders wires behind component boxes', () => {
    const svg = renderSVG(sample);
    expect(svg.indexOf('wd-layer-wires')).toBeLessThan(svg.indexOf('wd-layer-components'));
  });
});

describe('createSVGView', () => {
  it('supports selection callbacks', () => {
    const host = document.createElement('div');
    const selected: Array<string | null> = [];
    const hovered: Array<string | null> = [];
    const view = createSVGView(host, sample, {
      onSelect: (id) => selected.push(id),
      onHover: (id) => hovered.push(id),
    });

    const component = host.querySelector('[data-id="src"]') as SVGElement;
    expect(component).toBeTruthy();
    component.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(selected).toContain('src');

    view.select('vcc');
    expect(host.querySelector('[data-id="vcc"]')?.classList.contains('wd-selected')).toBe(true);

    view.reset();
    view.destroy();
    expect(host.childNodes.length).toBe(0);
  });

  it('zooms toward the cursor instead of the viewBox origin', () => {
    const host = document.createElement('div');
    const view = createSVGView(host, sample, {
      onSelect() {},
      onHover() {},
    });
    const svg = host.querySelector('svg') as SVGSVGElement;
    const viewport = svg.parentElement as HTMLElement;
    mockSvgLayout(svg, { left: 80, top: 40, width: 900, height: 500 });

    const cursor = { clientX: 620, clientY: 310 };
    const before = readContentTransform(svg);
    const point = svgUserPoint(svg, cursor);
    expect(point.x).not.toBeCloseTo(svg.viewBox.baseVal.x);
    expect(point.y).not.toBeCloseTo(svg.viewBox.baseVal.y);

    viewport.dispatchEvent(wheelAt(cursor, -120));

    const after = readContentTransform(svg);
    expect(after.scale).toBeCloseTo(before.scale * 1.1);
    expect(worldPoint(point, after)).toEqual({
      x: expect.closeTo(worldPoint(point, before).x),
      y: expect.closeTo(worldPoint(point, before).y),
    });
    expect(after.panX).not.toBeCloseTo(before.panX);
    expect(after.panY).not.toBeCloseTo(before.panY);

    view.destroy();
  });
});

function mockSvgLayout(
  svg: SVGSVGElement,
  rect: { left: number; top: number; width: number; height: number },
): void {
  svg.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON() {
        return this;
      },
    }) as DOMRect;
}

function svgUserPoint(
  svg: SVGSVGElement,
  cursor: { clientX: number; clientY: number },
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const bounds = svg.viewBox.baseVal;
  const meet = Math.min(rect.width / bounds.width, rect.height / bounds.height);
  const offsetX = (rect.width - bounds.width * meet) / 2;
  const offsetY = (rect.height - bounds.height * meet) / 2;
  return {
    x: bounds.x + (cursor.clientX - rect.left - offsetX) / meet,
    y: bounds.y + (cursor.clientY - rect.top - offsetY) / meet,
  };
}

function readContentTransform(svg: SVGSVGElement): { panX: number; panY: number; scale: number } {
  const value = svg.querySelector(':scope > g')?.getAttribute('transform') ?? '';
  const match = /translate\(([-\d.eE]+)[ ,]([-\d.eE]+)\) scale\(([-\d.eE]+)\)/.exec(value);
  if (!match) throw new Error(`Unexpected transform: ${value}`);
  return { panX: Number(match[1]), panY: Number(match[2]), scale: Number(match[3]) };
}

function worldPoint(
  cursor: { x: number; y: number },
  transform: { panX: number; panY: number; scale: number },
): { x: number; y: number } {
  return {
    x: (cursor.x - transform.panX) / transform.scale,
    y: (cursor.y - transform.panY) / transform.scale,
  };
}

function wheelAt(cursor: { clientX: number; clientY: number }, deltaY: number): WheelEvent {
  return new WheelEvent('wheel', {
    ...cursor,
    deltaY,
    bubbles: true,
    cancelable: true,
  });
}
