import mermaid from 'mermaid';

import { debounce } from '../utils/debounce';

export type PreviewScheduler = (doc: string) => void;

export interface PreviewStatusCallbacks {
  onRenderStart?: () => void;
  onRenderSuccess?: () => void;
  onRenderEmpty?: () => void;
  onRenderError?: (details: string) => void;
}

export function createPreview(
  previewEl: HTMLElement,
  delay: number,
  callbacks: PreviewStatusCallbacks = {}
): PreviewScheduler {
  let latestToken = 0;
  const debouncedRender = debounce(async (source: string, token: number) => {
    if (token !== latestToken) return;

    const trimmed = source.trim();
    if (!trimmed.length) {
      showPreviewMessage(previewEl, 'Add Mermaid markup to see the preview.');
      callbacks.onRenderEmpty?.();
      return;
    }

    const sandbox = createRenderSandbox(previewEl);
    try {
      const renderId = `mermaid-${Date.now()}-${token}`;
      const { svg } = await mermaid.render(renderId, trimmed, sandbox);
      if (token !== latestToken) return;
      previewEl.classList.remove('preview-empty', 'preview-error');
      previewEl.innerHTML = svg;
      callbacks.onRenderSuccess?.();
    } catch (error) {
      console.error('Mermaid render failed', error);
      const details = error instanceof Error ? error.message : String(error ?? 'Unknown error');
      showPreviewError(previewEl, 'Mermaid could not render this diagram.', details);
      callbacks.onRenderError?.(details);
    } finally {
      sandbox.remove();
    }
  }, delay);

  return (source: string) => {
    latestToken += 1;
    const currentToken = latestToken;
    callbacks.onRenderStart?.();
    debouncedRender(source, currentToken);
  };
}

function showPreviewMessage(previewEl: HTMLElement, message: string): void {
  previewEl.classList.add('preview-empty');
  previewEl.classList.remove('preview-error');

  const paragraph = document.createElement('p');
  paragraph.className = 'preview-message';
  paragraph.textContent = message;
  previewEl.replaceChildren(paragraph);
}

function showPreviewError(previewEl: HTMLElement, message: string, details: string): void {
  previewEl.classList.remove('preview-empty');
  previewEl.classList.add('preview-error');

  const container = document.createElement('div');
  const heading = document.createElement('p');
  heading.className = 'preview-message';
  heading.textContent = message;
  const pre = document.createElement('pre');
  pre.textContent = details;

  container.append(heading, pre);
  previewEl.replaceChildren(container);
}

function createRenderSandbox(previewEl: HTMLElement): HTMLDivElement {
  const sandbox = document.createElement('div');
  sandbox.setAttribute('aria-hidden', 'true');
  sandbox.style.position = 'absolute';
  sandbox.style.width = '0';
  sandbox.style.height = '0';
  sandbox.style.overflow = 'hidden';
  sandbox.style.pointerEvents = 'none';
  previewEl.append(sandbox);
  return sandbox;
}
