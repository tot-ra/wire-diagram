import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gallerySections, isolateComponent } from '../examples/gallery';
import { parseDiagram } from '../src/parser.js';

describe('showcase gallery', () => {
  const diagram = parseDiagram(readFileSync(resolve(import.meta.dirname, '../examples/showcase.yaml'), 'utf8'));

  it('keeps Beehive sensor bench as the first section and isolates every catalog part', () => {
    const sections = gallerySections(diagram);
    expect(sections[0]?.label).toBe('Beehive sensor bench');
    expect(sections.map((section) => section.components.length).reduce((sum, count) => sum + count, 0)).toBe(
      diagram.components.length,
    );
    expect(sections.every((section) => section.components.length > 0)).toBe(true);
    const displays = sections.find((section) => section.id === 'displays');
    expect(displays?.label).toBe('Displays');
    expect(displays?.components.map((component) => component.kind)).toEqual(['display', 'lcd1602', 'lcd2004']);
    const arduino = sections.find((section) => section.id === 'arduino');
    expect(arduino?.label).toBe('Arduino');
    expect(arduino?.components.map((component) => component.kind)).toEqual(['arduino-uno']);
    expect(sections.find((section) => section.id === 'frame')?.components.some((component) => component.kind === 'display')).toBe(
      false,
    );
    expect(sections.find((section) => section.id === 'sensors')?.components.some((component) => component.kind === 'lcd1602')).toBe(
      false,
    );
  });

  it('frames each part on the origin without catalog wires', () => {
    const loadCell = diagram.components.find((component) => component.id === 'load')!;
    const isolated = isolateComponent(loadCell);
    expect(isolated.wires).toEqual([]);
    expect(isolated.components).toHaveLength(1);
    expect(isolated.title).toBe(loadCell.label);
    expect(isolated.components[0]?.position[0]).toBe(0);
    expect(isolated.components[0]?.position[2]).toBe(0);
    expect(isolated.components[0]?.group).toBeUndefined();
  });
});
