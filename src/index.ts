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
  const subtitle = element('p');
  heading.append(title, subtitle);
  const controls = element('div', 'wd-controls');
  const b2d = element('button', '', 'Schematic');
  const b3d = element('button', '', '3D assembly');
  const reset = element('button', '', 'Reset view');
  const exportButton = element('button', '', 'Export SVG');
  for (const b of [b2d, b3d, reset, exportButton]) b.type = 'button';
  controls.append(b2d, b3d, reset, exportButton);
  toolbar.append(heading, controls);
  const body = element('div', 'wd-body');
  const viewport = element('div', 'wd-viewport');
  const stage = element('div', 'wd-stage');
  const hint = element('div', 'wd-hint');
  const tooltip = element('div', 'wd-tooltip');
  tooltip.hidden = true;
  viewport.append(stage, hint, tooltip);
  const inspector = element('aside', 'wd-inspector');
  inspector.setAttribute('aria-label', 'Connection inspector');
  inspector.setAttribute('aria-live', 'polite');
  body.append(viewport, inspector);
  const status = element('p', 'wd-status');
  status.setAttribute('role', 'status');
  const lower = element('div', 'wd-lower');
  root.append(toolbar, body, status, lower);
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
    inspector.replaceChildren(element('span', 'wd-eyebrow', selected ? 'INSPECT CONNECTION' : 'BUILD WITH CONFIDENCE'));
    const c = diagram.components.find(c => c.id === selected);
    const w = diagram.wires.find(w => w.id === selected);
    if (c) {
      inspector.append(element('h3', '', c.label));
      detail('Component', c.id);
      detail('Body size', `${c.dimensions.join(' × ')} mm`);
      detail('Model', c.model ? 'External glTF / GLB' : `${c.kind} · illustrative`);
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
      detail('From', w.from); detail('To', w.to); detail('Net', w.net);
      detail('Voltage', w.voltage === undefined ? undefined : `${w.voltage} V`);
      detail('Cut length', w.lengthMm === undefined ? undefined : `${w.lengthMm} mm`);
      detail('Outer diameter', w.diameterMm === undefined ? undefined : `${w.diameterMm} mm`);
      detail('Wire gauge', w.gaugeAwg === undefined ? undefined : `${w.gaugeAwg} AWG`);
      if (w.notes) inspector.append(element('p', '', w.notes));
    } else {
      inspector.append(element('h3', '', 'One circuit. Two perspectives.'), element('p', '', 'Select a component or wire to see its exact contacts, specifications and sourcing information. The same connections are used in both views.'));
      detail('Components', diagram.components.length); detail('Connections', diagram.wires.length);
      inspector.append(element('p', 'wd-caution', 'Verify the pinout and voltage levels of your actual hardware before connecting power. 3D models are illustrative.'));
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
    subtitle.textContent = diagram.description || 'A shared source for schematic and physical wiring';
    lower.replaceChildren();
    const notes = element('div', 'wd-notes');
    notes.append(element('h3', '', 'Assembly notes'));
    const list = element('ul');
    for (const note of [...diagram.notes, ...diagram.groups.flatMap(g => g.notes ? [`${g.label}: ${g.notes}`] : [])]) list.append(element('li', '', note));
    notes.append(list);
    const bom = element('details', 'wd-bom');
    bom.append(element('summary', '', `Bill of materials · ${diagram.components.reduce((n, c) => n + c.quantity, 0)} parts`));
    const table = element('table');
    const head = element('tr');
    for (const label of ['Component', 'Qty', 'Part / source']) head.append(element('th', '', label));
    table.append(head);
    for (const c of diagram.components) {
      const row = element('tr'); const sourceCell = element('td');
      if (c.purchase) {
        const link = element('a', '', c.purchase.partNumber || c.purchase.label || 'Supplier ↗');
        link.href = c.purchase.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; sourceCell.append(link);
      } else sourceCell.textContent = 'Not specified';
      row.append(element('td', '', c.label), element('td', '', String(c.quantity)), sourceCell); table.append(row);
    }
    bom.append(table, element('p', '', 'Supplier links are author-provided, not endorsements. Wires, connectors and tools may need to be ordered separately.'));
    lower.append(notes, bom); inspect();
  }
  const callbacks = {
    onSelect: (id: string | null) => api.select(id),
    onHover: (id: string | null) => { tooltip.hidden = !id; tooltip.textContent = id ? entityLabel(id) : ''; },
    onError: (message: string) => { if (!disposed) status.textContent = `${message} You can return to the schematic.`; },
  };
  async function setView(mode: '2d' | '3d') {
    if (disposed) return;
    if (mode !== '2d' && mode !== '3d') throw new Error('View must be 2d or 3d');
    const token = ++generation;
    currentView = mode;
    view?.destroy(); view = undefined; stage.replaceChildren(); tooltip.hidden = true;
    b2d.setAttribute('aria-pressed', String(mode === '2d')); b3d.setAttribute('aria-pressed', String(mode === '3d'));
    hint.textContent = mode === '2d' ? 'Drag to pan · scroll to zoom · select a connection' : 'Drag to orbit · scroll to zoom · select a wire';
    status.textContent = mode === '3d' ? 'Illustrative models. Pin anchors and dimensions must be verified for your board variant.' : '';
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
  b2d.addEventListener('click', () => void setView('2d'));
  b3d.addEventListener('click', () => void setView('3d'));
  reset.addEventListener('click', () => view?.reset());
  exportButton.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([api.exportSVG()], { type: 'image/svg+xml' }));
    const link = element('a'); link.href = url; link.download = 'wiring-diagram.svg'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  renderMetadata(); void setView(options.view ?? '2d');
  return api;
}
