import { createWiringDiagram } from '../src/index';
import source from './beehive.yaml?raw';
const editor = document.querySelector<HTMLTextAreaElement>('#yaml')!;
const error = document.querySelector<HTMLElement>('#error')!;
editor.value = source;
const widget = createWiringDiagram(document.querySelector<HTMLElement>('#diagram')!, source);
document.querySelector('#apply')!.addEventListener('click', () => {
  try { widget.update(editor.value); error.textContent = 'Diagram updated.'; error.dataset.state = 'success'; }
  catch (e) { error.textContent = e instanceof Error ? e.message : String(e); error.dataset.state = 'error'; }
});
document.querySelector('#restore')!.addEventListener('click', () => { editor.value = source; widget.update(source); error.textContent = ''; });
if (import.meta.hot) import.meta.hot.dispose(() => widget.destroy());
