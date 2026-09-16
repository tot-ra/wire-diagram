import { createWiringDiagram, parseDiagram } from '../src/index';
import type { WiringWidget } from '../src/index';
import beehiveSource from './beehive.yaml?raw';
import showcaseSource from './showcase.yaml?raw';
import { mountShowcaseGallery, type ShowcaseGallery } from './showcase-gallery';

const editor = document.querySelector<HTMLTextAreaElement>('#yaml')!;
const error = document.querySelector<HTMLElement>('#error')!;
const diagramHost = document.querySelector<HTMLElement>('#diagram')!;
const galleryHost = document.querySelector<HTMLElement>('#gallery')!;

let widget: WiringWidget | undefined;
let gallery: ShowcaseGallery | undefined;

function destroy(): void {
  widget?.destroy();
  widget = undefined;
  gallery?.destroy();
  gallery = undefined;
}

function mountPage(source: string): void {
  destroy();
  widget = createWiringDiagram(diagramHost, source, { view: '2d' });
  gallery = mountShowcaseGallery(galleryHost, parseDiagram(showcaseSource));
}

editor.value = beehiveSource;
mountPage(beehiveSource);

document.querySelector('#apply')!.addEventListener('click', () => {
  try {
    widget?.update(editor.value);
    error.textContent = 'Diagram updated.';
    error.dataset.state = 'success';
  } catch (e) {
    error.textContent = e instanceof Error ? e.message : String(e);
    error.dataset.state = 'error';
  }
});

document.querySelector('#restore')!.addEventListener('click', () => {
  editor.value = beehiveSource;
  error.textContent = '';
  widget?.destroy();
  widget = createWiringDiagram(diagramHost, editor.value, { view: '2d' });
});

if (import.meta.hot) import.meta.hot.dispose(() => destroy());
