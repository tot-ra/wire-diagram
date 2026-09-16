import type { Component, Diagram, Pin, ViewCallbacks, ViewHandle } from './types.js';

const BOX_WIDTH = 230;
const BOX_PADDING_Y = 28;
const TITLE_BAND = 22;
const PIN_ROW = 24;
const GRID_COLS = 3;
const GRID_GAP_X = 90;
const GRID_GAP_Y = 50;
const GROUP_PAD = 18;
const GROUP_TITLE_HEIGHT = 38;
const WIRE_STUB = 16;
const WIRE_LANE_GAP = 8;
const VIEW_MARGIN = 40;

interface LayoutPin {
  componentId: string;
  pin: Pin;
  x: number;
  y: number;
  side: 'left' | 'right';
}

interface ComponentLayout {
  component: Component;
  x: number;
  y: number;
  width: number;
  height: number;
  pins: LayoutPin[];
}

interface SceneLayout {
  components: ComponentLayout[];
  minX: number;
  minY: number;
  width: number;
  height: number;
  pinByEndpoint: Map<string, LayoutPin>;
  layoutByComponentId: Map<string, ComponentLayout>;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Preserve author pin order within each side. */
function pinsBySide(component: Component): { left: Pin[]; right: Pin[] } {
  const left: Pin[] = [];
  const right: Pin[] = [];
  for (const pin of component.pins) {
    if (pin.side === 'left') left.push(pin);
    else right.push(pin);
  }
  return { left, right };
}

function componentHeight(component: Component): number {
  const { left, right } = pinsBySide(component);
  const rows = Math.max(left.length, right.length, 1);
  return TITLE_BAND + BOX_PADDING_Y + rows * PIN_ROW + BOX_PADDING_Y / 2;
}

const DEFAULT_BOX_HEIGHT = TITLE_BAND + BOX_PADDING_Y + PIN_ROW + BOX_PADDING_Y / 2;

function computeAutoGridRowHeights(components: Component[]): number[] {
  const rowHeights: number[] = [];
  components.forEach((component, index) => {
    if (component.schematic) return;
    const row = Math.floor(index / GRID_COLS);
    rowHeights[row] = Math.max(rowHeights[row] ?? DEFAULT_BOX_HEIGHT, componentHeight(component));
  });
  return rowHeights;
}

function defaultSchematicPosition(index: number, rowHeights: number[]): [number, number] {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  let y = 0;
  for (let r = 0; r < row; r += 1) {
    y += (rowHeights[r] ?? DEFAULT_BOX_HEIGHT) + GRID_GAP_Y;
  }
  return [col * (BOX_WIDTH + GRID_GAP_X), y];
}

function layoutDiagram(diagram: Diagram): SceneLayout {
  const pinByEndpoint = new Map<string, LayoutPin>();
  const layoutByComponentId = new Map<string, ComponentLayout>();
  const rowHeights = computeAutoGridRowHeights(diagram.components);

  const components: ComponentLayout[] = diagram.components.map((component, index) => {
    const [sx, sy] = component.schematic ?? defaultSchematicPosition(index, rowHeights);
    const height = componentHeight(component);
    const { left, right } = pinsBySide(component);
    const pins: LayoutPin[] = [];
    const pinStartY = sy + TITLE_BAND + BOX_PADDING_Y;

    left.forEach((pin, pinIndex) => {
      const layoutPin: LayoutPin = {
        componentId: component.id,
        pin,
        x: sx,
        y: pinStartY + pinIndex * PIN_ROW + PIN_ROW / 2,
        side: 'left',
      };
      pins.push(layoutPin);
      pinByEndpoint.set(`${component.id}.${pin.id}`, layoutPin);
    });

    right.forEach((pin, pinIndex) => {
      const layoutPin: LayoutPin = {
        componentId: component.id,
        pin,
        x: sx + BOX_WIDTH,
        y: pinStartY + pinIndex * PIN_ROW + PIN_ROW / 2,
        side: 'right',
      };
      pins.push(layoutPin);
      pinByEndpoint.set(`${component.id}.${pin.id}`, layoutPin);
    });

    const layout = { component, x: sx, y: sy, width: BOX_WIDTH, height, pins };
    layoutByComponentId.set(component.id, layout);
    return layout;
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const layout of components) {
    minX = Math.min(minX, layout.x);
    minY = Math.min(minY, layout.y);
    maxX = Math.max(maxX, layout.x + layout.width);
    maxY = Math.max(maxY, layout.y + layout.height);
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 320;
    maxY = 240;
  }

  minX -= VIEW_MARGIN;
  minY -= VIEW_MARGIN;
  maxX += VIEW_MARGIN;
  maxY += VIEW_MARGIN;

  return {
    components,
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
    pinByEndpoint,
    layoutByComponentId,
  };
}

function expandBoundsForGroups(
  diagram: Diagram,
  layout: SceneLayout,
): { minX: number; minY: number; maxX: number; maxY: number } {
  let { minX, minY, width, height } = layout;
  let maxX = minX + width;
  let maxY = minY + height;

  if (!diagram.groups.length) return { minX, minY, maxX, maxY };

  const byGroup = new Map<string, ComponentLayout[]>();
  for (const item of layout.components) {
    const groupId = item.component.group;
    if (!groupId) continue;
    const list = byGroup.get(groupId) ?? [];
    list.push(item);
    byGroup.set(groupId, list);
  }

  for (const group of diagram.groups) {
    const members = byGroup.get(group.id);
    if (!members?.length) continue;
    let gMinX = Infinity;
    let gMinY = Infinity;
    let gMaxX = -Infinity;
    let gMaxY = -Infinity;
    for (const member of members) {
      gMinX = Math.min(gMinX, member.x);
      gMinY = Math.min(gMinY, member.y);
      gMaxX = Math.max(gMaxX, member.x + member.width);
      gMaxY = Math.max(gMaxY, member.y + member.height);
    }
    minX = Math.min(minX, gMinX - GROUP_PAD);
    minY = Math.min(minY, gMinY - GROUP_PAD - GROUP_TITLE_HEIGHT);
    maxX = Math.max(maxX, gMaxX + GROUP_PAD);
    maxY = Math.max(maxY, gMaxY + GROUP_PAD);
  }

  return { minX, minY, maxX, maxY };
}

function groupBackgrounds(diagram: Diagram, layout: SceneLayout): string {
  if (!diagram.groups.length) return '';

  const byGroup = new Map<string, ComponentLayout[]>();
  for (const item of layout.components) {
    const groupId = item.component.group;
    if (!groupId) continue;
    const list = byGroup.get(groupId) ?? [];
    list.push(item);
    byGroup.set(groupId, list);
  }

  const parts: string[] = [];
  for (const group of diagram.groups) {
    const members = byGroup.get(group.id);
    if (!members?.length) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const member of members) {
      minX = Math.min(minX, member.x);
      minY = Math.min(minY, member.y);
      maxX = Math.max(maxX, member.x + member.width);
      maxY = Math.max(maxY, member.y + member.height);
    }
    const color = group.color ?? '#94a3b8';
    const rectX = minX - GROUP_PAD;
    const rectY = minY - GROUP_PAD - GROUP_TITLE_HEIGHT;
    const rectW = maxX - minX + GROUP_PAD * 2;
    const rectH = maxY - minY + GROUP_PAD * 2 + GROUP_TITLE_HEIGHT;
    parts.push(
      `<rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" rx="14" fill="${escapeXml(color)}" fill-opacity="0.14" stroke="${escapeXml(color)}" stroke-opacity="0.35" data-group="${escapeXml(group.id)}" />`,
      `<text x="${rectX + 12}" y="${rectY + 26}" class="wd-group-label">${escapeXml(group.label)}</text>`,
    );
  }
  return parts.join('');
}

function wireNeedsDetour(from: LayoutPin, to: LayoutPin): boolean {
  if (from.side === to.side) return true;
  const startOutX = from.x + (from.side === 'left' ? -WIRE_STUB : WIRE_STUB);
  const endOutX = to.x + (to.side === 'left' ? -WIRE_STUB : WIRE_STUB);
  if (from.side === 'right' && to.side === 'left' && endOutX <= startOutX) return true;
  if (from.side === 'left' && to.side === 'right' && endOutX <= startOutX) return true;
  return false;
}

function detourY(fromLayout: ComponentLayout, toLayout: ComponentLayout, lane: number): number {
  const bottom = Math.max(fromLayout.y + fromLayout.height, toLayout.y + toLayout.height);
  return bottom + 20 + lane * WIRE_LANE_GAP;
}

function routeWirePath(
  from: LayoutPin,
  to: LayoutPin,
  fromLayout: ComponentLayout,
  toLayout: ComponentLayout,
  lane: number,
): string {
  const sx = from.x;
  const sy = from.y;
  const ex = to.x;
  const ey = to.y;
  const startOutX = sx + (from.side === 'left' ? -WIRE_STUB : WIRE_STUB);
  const endOutX = ex + (to.side === 'left' ? -WIRE_STUB : WIRE_STUB);

  if (wireNeedsDetour(from, to)) {
    const routeY = detourY(fromLayout, toLayout, lane);
    return `M ${sx} ${sy} H ${startOutX} V ${routeY} H ${endOutX} V ${ey} H ${ex}`;
  }

  const laneOffset = lane * WIRE_LANE_GAP;
  if (Math.abs(sy - ey) < 0.5) {
    return `M ${sx} ${sy} H ${startOutX} H ${endOutX} H ${ex}`;
  }

  const midY = (sy + ey) / 2 + laneOffset;
  return `M ${sx} ${sy} H ${startOutX} V ${midY} H ${endOutX} V ${ey} H ${ex}`;
}

function wireMidpoint(path: string): [number, number] | null {
  const points: [number, number][] = [];
  let cx = 0;
  let cy = 0;
  const segments = path.match(/[MHV][^MHV]*/g);
  if (!segments) return null;

  for (const segment of segments) {
    const cmd = segment[0];
    const nums = segment
      .slice(1)
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((value) => !Number.isNaN(value));
    if (cmd === 'M' && nums.length >= 2) {
      cx = nums[0];
      cy = nums[1];
      points.push([cx, cy]);
    } else if (cmd === 'H' && nums.length >= 1) {
      cx = nums[nums.length - 1];
      points.push([cx, cy]);
    } else if (cmd === 'V' && nums.length >= 1) {
      cy = nums[nums.length - 1];
      points.push([cx, cy]);
    }
  }

  if (!points.length) return null;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

function renderComponent(layout: ComponentLayout, interactive: boolean): string {
  const { component, x, y, width, height } = layout;
  const fill = component.color ?? '#f8fafc';
  const attrs = interactive
    ? ` tabindex="0" role="button" aria-label="${escapeXml(component.label)}" data-kind="component" data-id="${escapeXml(component.id)}" class="wd-focusable wd-component"`
    : '';
  const title = `<text x="${x + width / 2}" y="${y + 16}" text-anchor="middle" class="wd-component-title">${escapeXml(component.label)}</text>`;
  const box = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${escapeXml(fill)}" stroke="#334155" stroke-width="1.5"${attrs} />`;

  const pinParts = layout.pins.map((layoutPin) => {
    const label = layoutPin.pin.label ?? layoutPin.pin.id;
    const dotX = layoutPin.x;
    const textAnchor = layoutPin.side === 'left' ? 'start' : 'end';
    const textX = layoutPin.side === 'left' ? layoutPin.x + 10 : layoutPin.x - 10;
    return [
      `<circle cx="${dotX}" cy="${layoutPin.y}" r="4" fill="#0f172a" />`,
      `<text x="${textX}" y="${layoutPin.y + 4}" text-anchor="${textAnchor}" class="wd-pin-label">${escapeXml(label)}</text>`,
    ].join('');
  });

  return `${box}${title}${pinParts.join('')}`;
}

function renderWires(diagram: Diagram, layout: SceneLayout, interactive: boolean): string {
  const wireParts: string[] = [];

  diagram.wires.forEach((wire, lane) => {
    const from = layout.pinByEndpoint.get(wire.from);
    const to = layout.pinByEndpoint.get(wire.to);
    if (!from || !to) return;

    const fromLayout = layout.layoutByComponentId.get(from.componentId);
    const toLayout = layout.layoutByComponentId.get(to.componentId);
    if (!fromLayout || !toLayout) return;

    const path = routeWirePath(from, to, fromLayout, toLayout, lane);
    const dash = wire.dashed ? ' stroke-dasharray="8 6"' : '';
    const attrs = interactive
      ? ` tabindex="0" role="button" aria-label="${escapeXml(wire.label || `${wire.from} to ${wire.to}`)}" data-kind="wire" data-id="${escapeXml(wire.id)}" class="wd-focusable wd-wire"`
      : '';
    wireParts.push(
      `<path d="${path}" fill="none" stroke="${escapeXml(wire.color)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"${dash}${attrs} />`,
    );

    if (wire.label) {
      const midpoint = wireMidpoint(path);
      if (midpoint) {
        const [mx, my] = midpoint;
        wireParts.push(`<text x="${mx}" y="${my - 6}" text-anchor="middle" class="wd-wire-label">${escapeXml(wire.label)}</text>`);
      }
    }
  });

  return wireParts.join('');
}

function svgStyles(): string {
  return `<style>
    .wd-schematic { font-family: system-ui, -apple-system, Segoe UI, sans-serif; background: #f1f5f9; }
    .wd-component-title, .wd-pin-label, .wd-wire-label, .wd-group-label { pointer-events: none; }
    .wd-component-title { font-size: 13px; font-weight: 700; fill: #0f172a; }
    .wd-pin-label { font-size: 11px; font-weight: 600; fill: #1e293b; paint-order: stroke fill; stroke: #f8fafc; stroke-width: 3px; }
    .wd-wire-label { font-size: 10px; fill: #334155; font-weight: 700; paint-order: stroke fill; stroke: #f1f5f9; stroke-width: 3px; }
    .wd-group-label { font-size: 12px; fill: #334155; font-weight: 700; }
    .wd-focusable { cursor: pointer; outline: none; }
    .wd-focusable:focus { stroke: #2563eb; stroke-width: 3; }
    .wd-component.wd-selected { stroke: #2563eb; stroke-width: 3; }
    .wd-wire.wd-selected { stroke-width: 4; filter: drop-shadow(0 0 2px #2563eb); }
    .wd-component.wd-hovered:not(.wd-selected) { stroke: #64748b; stroke-width: 2.5; }
    .wd-wire.wd-hovered:not(.wd-selected) { stroke-width: 3.5; opacity: 0.92; }
  </style>`;
}

function buildSvgMarkup(diagram: Diagram, interactive: boolean): string {
  const layout = layoutDiagram(diagram);
  const bounds = expandBoundsForGroups(diagram, layout);
  // Detours can extend below the boxes; include every routed wire in the exported framing.
  diagram.wires.forEach((wire, lane) => {
    const from = layout.pinByEndpoint.get(wire.from);
    const to = layout.pinByEndpoint.get(wire.to);
    if (!from || !to) return;
    const a = layout.layoutByComponentId.get(from.componentId)!;
    const b = layout.layoutByComponentId.get(to.componentId)!;
    const path = routeWirePath(from, to, a, b, lane);
    for (const segment of path.match(/[MHV][^MHV]*/g) || []) {
      const values = segment.slice(1).trim().split(/\s+/).map(Number);
      if (segment[0] === 'H' || segment[0] === 'M') {
        bounds.minX = Math.min(bounds.minX, values[0] - 20);
        bounds.maxX = Math.max(bounds.maxX, values[0] + 20);
      }
      const y = segment[0] === 'M' ? values[1] : segment[0] === 'V' ? values[0] : undefined;
      if (y !== undefined) { bounds.minY = Math.min(bounds.minY, y - 20); bounds.maxY = Math.max(bounds.maxY, y + 20); }
    }
  });
  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`;
  const groups = groupBackgrounds(diagram, layout);
  const components = layout.components.map((item) => renderComponent(item, interactive)).join('');
  const wires = renderWires(diagram, layout, interactive);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" class="wd-schematic" role="img" aria-label="${escapeXml(diagram.title)}">
${svgStyles()}
<rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.maxX - bounds.minX}" height="${bounds.maxY - bounds.minY}" fill="#f1f5f9" />
<g class="wd-layer-groups">${groups}</g>
<g class="wd-layer-wires">${wires}</g>
<g class="wd-layer-components">${components}</g>
</svg>`;
}

export function renderSVG(diagram: Diagram): string {
  return buildSvgMarkup(diagram, false);
}

/** Map a pointer into SVG viewBox space, matching default xMidYMid meet. */
function svgPointFromClient(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const rect = svg.getBoundingClientRect();
  const bounds = svg.viewBox.baseVal;
  if (rect.width <= 0 || rect.height <= 0 || bounds.width <= 0 || bounds.height <= 0) return null;
  const meet = Math.min(rect.width / bounds.width, rect.height / bounds.height);
  const offsetX = (rect.width - bounds.width * meet) / 2;
  const offsetY = (rect.height - bounds.height * meet) / 2;
  return {
    x: bounds.x + (clientX - rect.left - offsetX) / meet,
    y: bounds.y + (clientY - rect.top - offsetY) / meet,
  };
}

export function createSVGView(host: HTMLElement, diagram: Diagram, callbacks: ViewCallbacks): ViewHandle {
  host.innerHTML = buildSvgMarkup(diagram, true);

  const svg = host.querySelector('svg');
  const viewport = document.createElement('div');
  viewport.style.width = '100%';
  viewport.style.height = '100%';
  viewport.style.overflow = 'hidden';
  viewport.style.position = 'relative';
  viewport.style.background = '#f1f5f9';
  viewport.style.touchAction = 'none';

  if (svg) {
    svg.style.display = 'block';
    svg.style.width = '100%';
    svg.style.height = '100%';
    host.replaceChildren(viewport);
    viewport.appendChild(svg);
  }

  const content = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  while (svg && svg.childNodes.length > 0) {
    content.appendChild(svg.firstChild!);
  }
  svg?.appendChild(content);

  let selectedId: string | null = null;
  let hoveredId: string | null = null;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panStartX = 0;
  let panStartY = 0;

  const applyTransform = (): void => {
    content.setAttribute('transform', `translate(${panX} ${panY}) scale(${scale})`);
  };

  const applyHighlight = (): void => {
    const nodes = host.querySelectorAll<SVGElement>('[data-id]');
    nodes.forEach((node) => {
      const id = node.getAttribute('data-id');
      node.classList.toggle('wd-selected', id === selectedId);
      node.classList.toggle('wd-hovered', id === hoveredId && id !== selectedId);
    });
  };

  const setSelection = (id: string | null): void => {
    selectedId = id;
    applyHighlight();
    callbacks.onSelect(id);
  };

  const setHover = (id: string | null): void => {
    hoveredId = id;
    applyHighlight();
    callbacks.onHover(id);
  };

  const pickId = (target: EventTarget | null): string | null => {
    let node = target as Element | null;
    while (node && node !== host) {
      const id = node.getAttribute?.('data-id');
      if (id) return id;
      node = node.parentElement;
    }
    return null;
  };

  const onPointerDown = (event: PointerEvent): void => {
    const id = pickId(event.target);
    if (id) {
      setSelection(id);
      return;
    }
    dragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    panStartX = panX;
    panStartY = panY;
    viewport.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (dragging) {
      const rect = svg!.getBoundingClientRect();
      const bounds = svg!.viewBox.baseVal;
      const ratio = Math.max(bounds.width / rect.width, bounds.height / rect.height);
      panX = panStartX + (event.clientX - dragStartX) * ratio;
      panY = panStartY + (event.clientY - dragStartY) * ratio;
      applyTransform();
      return;
    }
    setHover(pickId(event.target));
  };

  const onPointerUp = (event: PointerEvent): void => {
    dragging = false;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  };

  const onPointerLeave = (): void => {
    if (!dragging) setHover(null);
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const nextScale = Math.min(4, Math.max(0.35, scale * (event.deltaY > 0 ? 0.9 : 1.1)));
    if (nextScale === scale) return;
    // Scale around the pointer so the diagram point under the cursor stays put.
    if (svg) {
      const cursor = svgPointFromClient(svg, event.clientX, event.clientY);
      if (cursor) {
        panX = cursor.x - ((cursor.x - panX) / scale) * nextScale;
        panY = cursor.y - ((cursor.y - panY) / scale) * nextScale;
      }
    }
    scale = nextScale;
    applyTransform();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as Element | null;
    const id = target?.getAttribute?.('data-id');
    if (!id) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelection(id);
    }
  };

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);
  viewport.addEventListener('pointerleave', onPointerLeave);
  viewport.addEventListener('wheel', onWheel, { passive: false });
  host.addEventListener('keydown', onKeyDown);

  applyTransform();
  applyHighlight();

  return {
    select(id: string | null): void {
      // Programmatic synchronization must not emit another user selection event.
      selectedId = id;
      applyHighlight();
    },
    reset(): void {
      scale = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    },
    destroy(): void {
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
      viewport.removeEventListener('pointercancel', onPointerUp);
      viewport.removeEventListener('pointerleave', onPointerLeave);
      viewport.removeEventListener('wheel', onWheel);
      host.removeEventListener('keydown', onKeyDown);
      host.replaceChildren();
    },
  };
}
