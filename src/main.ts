import { indentWithTab } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { basicSetup, EditorView } from 'codemirror';
import mermaid from 'mermaid';
import 'remixicon/fonts/remixicon.css';

import { createMermaidLanguage } from './editor/language';
import { createEditorTheme } from './editor/theme';
import { createPreview } from './preview/render';
import { setupToolbarActions } from './toolbar/actions';
import { setupToolbarShortcuts } from './toolbar/shortcuts';
import { loadSettingsStore, setupWindowPersistence } from './window/state';
import { initHorizontalResize } from './workspace/resize';

const DEFAULT_SNIPPET = `graph TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- Not yet --> D[Keep iterating]`;

const RENDER_DELAY = 300;
const WINDOW_PERSIST_DELAY = 400;

const MERMAID_LANGUAGE = createMermaidLanguage();
const EDITOR_THEME = createEditorTheme();

window.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap(): Promise<void> {
  const host = document.querySelector<HTMLDivElement>('#editor-host');
  const previewElement = document.querySelector<HTMLDivElement>('#preview-host');
  const newDiagramButton = document.querySelector<HTMLButtonElement>('[data-action="new-diagram"]');
  const saveButton = document.querySelector<HTMLButtonElement>('[data-action="save-diagram"]');
  const openButton = document.querySelector<HTMLButtonElement>('[data-action="open-diagram"]');
  const examplesButton = document.querySelector<HTMLButtonElement>('[data-action="examples-menu"]');
  const examplesMenu = document.querySelector<HTMLDivElement>(
    '[data-dropdown="examples"] .toolbar-menu'
  );
  const exportButton = document.querySelector<HTMLButtonElement>('[data-action="export-menu"]');
  const exportMenu = document.querySelector<HTMLDivElement>(
    '[data-dropdown="export"] .toolbar-menu'
  );
  const statusMessage = document.querySelector<HTMLSpanElement>('[data-status="message"]');
  const workspace = document.querySelector<HTMLDivElement>('.workspace');
  const editorPane = document.querySelector<HTMLElement>('[data-pane="editor"]');
  const previewPane = document.querySelector<HTMLElement>('[data-pane="preview"]');
  const divider = document.querySelector<HTMLDivElement>('.divider');

  if (!host || !previewElement) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
  });

  const appWindow = getCurrentWindow();
  const store = await loadSettingsStore();

  if (store) {
    await setupWindowPersistence(store, appWindow, WINDOW_PERSIST_DELAY);
  }

  const status = createStatusController(statusMessage);
  const schedulePreviewRender = createPreview(previewElement, RENDER_DELAY, {
    onRenderStart() {
      status.rendering();
    },
    onRenderSuccess() {
      status.success('Preview updated successfully.');
    },
    onRenderEmpty() {
      status.info('Waiting for Mermaid markup…');
    },
    onRenderError(details) {
      status.error(details);
    },
  });
  let lastCommittedDoc = DEFAULT_SNIPPET;
  let isDocumentDirty = false;

  const handleDocChange = (doc: string) => {
    isDocumentDirty = doc !== lastCommittedDoc;
  };

  const commitDocument = (doc: string) => {
    lastCommittedDoc = doc;
    isDocumentDirty = false;
  };

  const editor = createEditor(host, DEFAULT_SNIPPET, schedulePreviewRender, handleDocChange);
  let currentFilePath: string | null = null;

  commitDocument(editor.state.doc.toString());

  editor.focus();
  host.dataset.editor = 'mounted';
  previewElement.dataset.preview = 'ready';
  schedulePreviewRender(editor.state.doc.toString());
  initHorizontalResize(workspace, editorPane, previewPane, divider);

  setupToolbarActions({
    editor,
    schedulePreviewRender,
    newDiagramButton,
    openButton,
    saveButton,
    exportButton,
    exportMenu,
    examplesButton,
    examplesMenu,
    isDirty() {
      return isDocumentDirty;
    },
    commitDocument,
    onPathChange(path) {
      currentFilePath = path;
    },
    getPath() {
      return currentFilePath;
    },
    defaultSnippet: DEFAULT_SNIPPET,
  });

  setupToolbarShortcuts({
    newButton: newDiagramButton,
    openButton,
    saveButton,
  });
}

function createEditor(
  host: HTMLElement,
  initialDoc: string,
  schedulePreviewRender: (doc: string) => void,
  onDocChange?: (doc: string) => void
): EditorView {
  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      basicSetup,
      MERMAID_LANGUAGE,
      EditorView.lineWrapping,
      EDITOR_THEME,
      keymap.of([indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const nextDoc = update.state.doc.toString();
          schedulePreviewRender(nextDoc);
          onDocChange?.(nextDoc);
        }
      }),
    ],
  });

  return new EditorView({
    parent: host,
    state,
  });
}

type StatusLevel = 'idle' | 'loading' | 'success' | 'error' | 'info';

function createStatusController(element: HTMLSpanElement | null): {
  idle(message?: string): void;
  rendering(message?: string): void;
  success(message?: string): void;
  info(message: string): void;
  error(details: string): void;
} {
  if (!element) {
    return {
      idle() {},
      rendering() {},
      success() {},
      info() {},
      error() {},
    };
  }

  const defaultMessage = (element.textContent || 'Ready.').trim() || 'Ready.';
  let revertTimer: number | null = null;

  function setStatus(message: string, level: StatusLevel, autoRevert = false): void {
    if (revertTimer !== null) {
      window.clearTimeout(revertTimer);
      revertTimer = null;
    }
    element.textContent = message;
    element.dataset.statusLevel = level;
    if (autoRevert) {
      revertTimer = window.setTimeout(() => {
        element.textContent = defaultMessage;
        element.dataset.statusLevel = 'idle';
        revertTimer = null;
      }, 4000);
    }
  }

  setStatus(defaultMessage, 'idle');

  return {
    idle(message) {
      setStatus(message ?? defaultMessage, 'idle');
    },
    rendering(message = 'Rendering preview…') {
      setStatus(message, 'loading');
    },
    success(message = 'Preview updated.') {
      setStatus(message, 'success', true);
    },
    info(message) {
      setStatus(message, 'info');
    },
    error(details) {
      const summary = details.split(/\r?\n/, 1)[0]?.trim() ?? 'Unknown error';
      setStatus(`Render failed: ${summary}`, 'error');
    },
  };
}
