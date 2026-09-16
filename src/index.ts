import { parseDiagram } from './parser.js';
import { createSVGView, renderSVG } from './svg.js';
import type { Diagram, ViewHandle } from './types.js';
import './style.css';

export { parseDiagram, getBom, DiagramParseError } from './parser.js';
export { renderSVG } from './svg.js';
export type * from './types.js';
export interface WidgetOptions { view?: '2d' | '3d'; }
export interface WiringWidget {
  update(source: unknown): void;
  setView(view: '2d' | '3d'): Promise<void>;
  select(id: string | null): void;
  exportSVG(): string;
  destroy(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Mount in an empty container. Invalid updates leave the current diagram intact. */
export function createWiringDiagram(host: HTMLElement, source: unknown, options: WidgetOptions = {}): WiringWidget {
  let diagram = parseDiagram(source);
  let disposed = false;
  let generation = 0;
  let selected: string | null = null;
  let currentView: '2d' | '3d' = '2d';
  let view: ViewHandle | undefined;
  const root = element('section', 'wd-widget');
  const toolbar = element('header', 'wd-toolbar');
  const heading = element('div', 'wd-heading');
  const title = element('h2');
  heading.append(title);
  toolbar.append(heading);
  const body = element('div', 'wd-body');
  const viewport = element('div', 'wd-viewport');
  const stage = element('div', 'wd-stage');
  const tooltip = element('div', 'wd-tooltip');
  tooltip.hidden = true;
  const canvasTools = element('div', 'wd-canvas-tools');
  const viewSwitch = element('div', 'wd-view-switch');
  const label2d = element('span', 'wd-view-caption', 'Schematic');
  const switchWrap = element('label', 'wd-switch');
  const viewToggle = element('input');
  viewToggle.type = 'checkbox';
  viewToggle.setAttribute('role', 'switch');
  viewToggle.setAttribute('aria-label', '3D view');
  switchWrap.append(viewToggle, element('span', 'wd-switch-track'));
  const label3d = element('span', 'wd-view-caption', '3D');
  viewSwitch.append(label2d, switchWrap, label3d);
  const reset = element('a', 'wd-reset', 'Reset');
  reset.href = '#';
  canvasTools.append(viewSwitch, reset);
  const exportButton = element('button', 'wd-export', 'Export SVG');
  exportButton.type = 'button';
  viewport.append(stage, tooltip, canvasTools, exportButton);
  const inspector = element('aside', 'wd-inspector');
  inspector.hidden = true;
  inspector.setAttribute('aria-label', 'Connection inspector');
  inspector.setAttribute('aria-live', 'polite');
  body.append(viewport, inspector);
  const status = element('p', 'wd-status');
  status.setAttribute('role', 'status');
  root.append(toolbar, body, status);
  host.append(root);

  function entityLabel(id: string): string {
    const component = diagram.components.find(c => c.id === id);
    if (component) return component.label;
    const wire = diagram.wires.find(w => w.id === id);
    return wire ? `${wire.label || wire.id}: ${wire.from} → ${wire.to}` : id;
  }
  function detail(label: string, value: unknown) {
    if (value === undefined) return;
    const row = element('div', 'wd-detail');
    row.append(element('dt', '', label), element('dd', '', String(value)));
    inspector.append(row);
  }
  function inspect() {
    inspector.replaceChildren();
    // Keep the select/details sidebar out of the way until a part is chosen on the canvas.
    if (!selected) {
      inspector.hidden = true;
      return;
    }
    inspector.hidden = false;
    const c = diagram.components.find(c => c.id === selected);
    const w = diagram.wires.find(w => w.id === selected);
    if (c) {
      inspector.append(element('h3', '', c.label));
      detail('Size', `${c.dimensions.join(' × ')} mm`);
      if (c.notes) inspector.append(element('p', '', c.notes));
      for (const [key, value] of Object.entries(c.properties ?? {})) detail(key, value);
      inspector.append(element('h4', '', 'Contacts'));
      for (const pin of c.pins) detail(pin.label || pin.id, pin.voltage === undefined ? pin.id : `${pin.id} · ${pin.voltage} V`);
      if (c.purchase) {
        const link = element('a', 'wd-buy', c.purchase.label || 'Find this component ↗');
        link.href = c.purchase.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        inspector.append(link);
      }
    } else if (w) {
      inspector.append(element('h3', '', w.label || w.id));
      const swatch = element('div', 'wd-swatch'); swatch.style.backgroundColor = w.color; inspector.append(swatch);
      detail('From', w.from); detail('To', w.to);
      detail('Voltage', w.voltage === undefined ? undefined : `${w.voltage} V`);
      detail('Length', w.lengthMm === undefined ? undefined : `${w.lengthMm} mm`);
      if (w.notes) inspector.append(element('p', '', w.notes));
    }
    const select = element('select', 'wd-select');
    select.setAttribute('aria-label', 'Select component or wire');
    select.append(new Option('Select a component or wire…', ''));
    for (const item of [...diagram.components, ...diagram.wires]) select.append(new Option(entityLabel(item.id), item.id));
    select.value = selected || '';
    select.addEventListener('change', () => api.select(select.value || null));
    inspector.append(select);
  }
  function renderMetadata() {
    title.textContent = diagram.title;
    inspect();
  }
  const callbacks = {
    onSelect: (id: string | null) => api.select(id),
    onHover: (id: string | null) => { tooltip.hidden = !id; tooltip.textContent = id ? entityLabel(id) : ''; },
    onError: (message: string) => { if (!disposed) status.textContent = message; },
  };
  async function setView(mode: '2d' | '3d') {
    if (disposed) return;
    if (mode !== '2d' && mode !== '3d') throw new Error('View must be 2d or 3d');
    const token = ++generation;
    currentView = mode;
    view?.destroy(); view = undefined; stage.replaceChildren(); tooltip.hidden = true;
    viewToggle.checked = mode === '3d';
    label2d.classList.toggle('wd-view-active', mode === '2d');
    label3d.classList.toggle('wd-view-active', mode === '3d');
    status.textContent = '';
    if (mode === '2d') view = createSVGView(stage, diagram, callbacks);
    else {
      stage.append(element('p', 'wd-loading', 'Loading 3D assembly…'));
      try {
        const { create3DView } = await import('./view3d.js');
        if (disposed || token !== generation) return;
        view = create3DView(stage, diagram, { ...callbacks, onError: message => { if (token === generation) callbacks.onError(message); } });
      } catch (error) {
        if (disposed || token !== generation) return;
        stage.replaceChildren(element('p', 'wd-loading', '3D could not start. The schematic is still available.'));
        callbacks.onError(error instanceof Error ? error.message : String(error));
      }
    }
    view?.select(selected);
  }
  const api: WiringWidget = {
    update(nextSource) {
      if (disposed) throw new Error('Widget has been destroyed');
      const next = parseDiagram(nextSource); // Validate before discarding a working view.
      diagram = next; selected = null; renderMetadata(); void setView(currentView);
    },
    setView,
    select(id) {
      if (disposed) return;
      selected = id && [...diagram.components, ...diagram.wires].some(item => item.id === id) ? id : null;
      view?.select(selected); inspect();
    },
    exportSVG: () => renderSVG(diagram),
    destroy() { if (disposed) return; disposed = true; generation++; view?.destroy(); root.remove(); },
  };
  label2d.addEventListener('click', () => void setView('2d'));
  label3d.addEventListener('click', () => void setView('3d'));
  viewToggle.addEventListener('change', () => void setView(viewToggle.checked ? '3d' : '2d'));
  reset.addEventListener('click', event => {
    event.preventDefault();
    view?.reset();
  });
  exportButton.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([api.exportSVG()], { type: 'image/svg+xml' }));
    const link = element('a'); link.href = url; link.download = 'wiring-diagram.svg'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  renderMetadata(); void setView(options.view ?? '2d');
  return api;
}
