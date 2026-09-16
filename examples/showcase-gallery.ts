import { createWiringDiagram, parseDiagram } from '../src/index';
import type { Diagram, WiringWidget } from '../src/index';
import { gallerySections, isolateComponent } from './gallery';

/** Browsers drop WebGL contexts after roughly 8-16 live canvases; keep a small pool. */
const MAX_LIVE_CANVASES = 12;
const VIEW_MARGIN_PX = 120;

export interface ShowcaseGallery {
  update(source: unknown): void;
  destroy(): void;
}

interface LiveCard {
  id: string;
  widget: WiringWidget;
}

function placeholder(): HTMLParagraphElement {
  const el = document.createElement('p');
  el.className = 'gallery-placeholder';
  el.textContent = '3D model';
  return el;
}

export function mountShowcaseGallery(host: HTMLElement, diagram: Diagram): ShowcaseGallery {
  let live: LiveCard[] = [];
  let observer: IntersectionObserver | undefined;
  let cards = new Map<string, HTMLElement>();
  let isolated = new Map<string, Diagram>();
  const intersecting = new Set<string>();

  function unmount(id: string): void {
    const index = live.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const [entry] = live.splice(index, 1);
    entry?.widget.destroy();
    const canvas = cards.get(id)?.querySelector<HTMLElement>('.gallery-canvas');
    if (canvas) canvas.replaceChildren(placeholder());
  }

  function mountOne(id: string): void {
    if (live.some((entry) => entry.id === id)) return;
    const source = isolated.get(id);
    const canvas = cards.get(id)?.querySelector<HTMLElement>('.gallery-canvas');
    if (!source || !canvas) return;
    canvas.replaceChildren();
    live.push({ id, widget: createWiringDiagram(canvas, source, { view: '3d' }) });
  }

  function reconcile(): void {
    // Prefer document order so the heading section on screen keeps its canvases.
    const desired = [...cards.keys()].filter((id) => intersecting.has(id)).slice(0, MAX_LIVE_CANVASES);
    const desiredSet = new Set(desired);
    for (const entry of [...live]) {
      if (!desiredSet.has(entry.id)) unmount(entry.id);
    }
    for (const id of desired) mountOne(id);
  }

  function captureViewport(): void {
    intersecting.clear();
    const viewH = window.innerHeight || 0;
    for (const [id, card] of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.bottom > -VIEW_MARGIN_PX && rect.top < viewH + VIEW_MARGIN_PX) intersecting.add(id);
    }
  }

  function onViewportChange(): void {
    captureViewport();
    reconcile();
  }

  function render(next: Diagram): void {
    for (const entry of live) entry.widget.destroy();
    live = [];
    observer?.disconnect();
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('scroll', onViewportChange);
    host.replaceChildren();
    cards = new Map();
    isolated = new Map();
    intersecting.clear();

    for (const section of gallerySections(next)) {
      const block = document.createElement('section');
      block.className = 'gallery-section';
      const heading = document.createElement('h2');
      heading.id = `gallery-${section.id}`;
      heading.textContent = section.label;
      block.setAttribute('aria-labelledby', heading.id);
      const grid = document.createElement('div');
      grid.className = 'gallery-grid';
      block.append(heading, grid);

      for (const component of section.components) {
        isolated.set(component.id, isolateComponent(component));
        const card = document.createElement('article');
        card.className = 'gallery-card';
        card.dataset.id = component.id;
        const canvas = document.createElement('div');
        canvas.className = 'gallery-canvas';
        canvas.append(placeholder());
        const caption = document.createElement('div');
        caption.className = 'gallery-caption';
        const title = document.createElement('h3');
        title.textContent = component.label;
        const kind = document.createElement('p');
        kind.className = 'gallery-kind';
        kind.textContent = component.kind;
        caption.append(title, kind);
        card.append(canvas, caption);
        grid.append(card);
        cards.set(component.id, card);
      }
      host.append(block);
    }

    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.id;
            if (!id) continue;
            if (entry.isIntersecting) intersecting.add(id);
            else intersecting.delete(id);
          }
          reconcile();
        },
        { rootMargin: `${VIEW_MARGIN_PX}px`, threshold: 0.01 },
      );
      for (const card of cards.values()) observer.observe(card);
    }

    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, { passive: true });
    // First paint often has no observer callback yet; measure the viewport now.
    onViewportChange();
  }

  render(diagram);

  return {
    update(source: unknown) {
      render(parseDiagram(source));
    },
    destroy() {
      observer?.disconnect();
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange);
      for (const entry of live) entry.widget.destroy();
      live = [];
      host.replaceChildren();
    },
  };
}
