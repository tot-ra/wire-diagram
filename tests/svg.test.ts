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
});
