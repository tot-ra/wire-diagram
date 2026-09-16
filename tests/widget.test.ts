// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createWiringDiagram } from '../src/index';
const source = { version: 1, title: 'Widget test', components: [{ id: 'a', label: 'A', pins: [{id:'out',side:'right'}] }, { id:'b',label:'B',pins:[{id:'in'}]}], wires:[{id:'w',from:'a.out',to:'b.in'}] };
describe('widget integration', () => {
  it('mounts and synchronizes selection without recursive callbacks', () => {
    const host = document.createElement('div');
    const widget = createWiringDiagram(host, source);
    expect(host.querySelector('svg')).not.toBeNull();
    expect(() => widget.select('w')).not.toThrow();
    expect(host.querySelector('.wd-inspector')!.textContent).toContain('a.out');
    expect(host.querySelector('[data-id="w"]')!.classList.contains('wd-selected')).toBe(true);
    host.querySelector('[data-id="a"]')!.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true}));
    expect(host.querySelector('.wd-inspector h3')!.textContent).toBe('A');
    widget.destroy(); expect(host.children).toHaveLength(0);
  });
  it('does not render assembly notes or a bill of materials in the widget chrome', () => {
    const host = document.createElement('div');
    const widget = createWiringDiagram(host, source);
    expect(host.querySelector('.wd-notes')).toBeNull();
    expect(host.querySelector('.wd-bom')).toBeNull();
    expect(host.querySelector('.wd-hint')).toBeNull();
    expect(host.textContent).not.toContain('BUILD WITH CONFIDENCE');
    widget.destroy();
  });
  it('retains a working diagram on invalid update and replaces valid updates', () => {
    const host = document.createElement('div'); const widget = createWiringDiagram(host, source);
    expect(() => widget.update('version: 99')).toThrow();
    expect(host.querySelector('h2')!.textContent).toBe('Widget test');
    widget.update({...source, title:'Updated'});
    expect(host.querySelector('h2')!.textContent).toBe('Updated');
    expect(widget.exportSVG()).toContain('Updated'); widget.destroy(); widget.destroy();
  });
  it('does not insert user HTML and isolates multiple instances', () => {
    const host = document.createElement('div'); const other = document.createElement('div');
    const widget = createWiringDiagram(host, {...source, title:'<img src=x onerror=alert(1)>'});
    const widget2 = createWiringDiagram(other, source);
    expect(host.querySelector('img')).toBeNull(); widget.select('w');
    expect(other.querySelector('.wd-selected')).toBeNull(); widget.destroy();
    expect(other.querySelector('svg')).not.toBeNull(); widget2.destroy();
  });
  it('ignores stale lazy 3D loads after switching back or destroying', async () => {
    const host = document.createElement('div'); const widget = createWiringDiagram(host, source);
    const pending = widget.setView('3d'); await widget.setView('2d'); await pending;
    expect(host.querySelector('svg')).not.toBeNull(); expect(host.querySelector('canvas')).toBeNull();
    const pending2 = widget.setView('3d'); widget.destroy(); await pending2;
    expect(host.children).toHaveLength(0);
  });
});

it('renders the complete beehive fixture with its pull-up as a component', async () => {
  const { readFileSync } = await import('node:fs');
  const { parseDiagram } = await import('../src/parser');
  const diagram = parseDiagram(readFileSync('examples/beehive.yaml', 'utf8'));
  expect(diagram.components).toHaveLength(6); expect(diagram.wires).toHaveLength(15);
  expect(diagram.wires.find(w => w.id === 'hx-power')?.from).toBe('esp.3V3');
  expect(diagram.wires.some(w => [w.from,w.to].includes('pullup.VCC') && [w.from,w.to].includes('pullup.DQ'))).toBe(false);
  const host = document.createElement('div'); const widget = createWiringDiagram(host, diagram);
  expect(host.querySelectorAll('[data-kind="wire"]')).toHaveLength(15); widget.destroy();
});
