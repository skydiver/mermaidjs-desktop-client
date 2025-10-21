const DEFAULT_EDITOR_RATIO = 0.5;
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

export function initHorizontalResize(
  container: HTMLElement | null,
  editorPane: HTMLElement | null,
  previewPane: HTMLElement | null,
  divider: HTMLDivElement | null
): void {
  if (!container || !editorPane || !previewPane || !divider) {
    return;
  }

  let isDragging = false;
  let startX = 0;
  let startEditorWidth = 0;
  let containerWidth = 0;

  const setEditorWidth = (ratio: number) => {
    const clamped = Math.min(Math.max(ratio, MIN_RATIO), MAX_RATIO);
    editorPane.style.flex = `${clamped} 1 0`;
    previewPane.style.flex = `${1 - clamped} 1 0`;
  };

  setEditorWidth(DEFAULT_EDITOR_RATIO);

  const onPointerMove = (event: PointerEvent) => {
    if (!isDragging) return;
    const delta = event.clientX - startX;
    const ratio = (startEditorWidth + delta) / containerWidth;
    setEditorWidth(ratio);
  };

  const stopDragging = () => {
    if (!isDragging) return;
    isDragging = false;
    divider.classList.remove('dragging');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDragging);
  };

  divider.addEventListener('pointerdown', (event) => {
    isDragging = true;
    startX = event.clientX;
    containerWidth = container.getBoundingClientRect().width;
    startEditorWidth = editorPane.getBoundingClientRect().width;
    divider.classList.add('dragging');

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
  });

  divider.addEventListener('dblclick', () => {
    setEditorWidth(DEFAULT_EDITOR_RATIO);
  });
}
