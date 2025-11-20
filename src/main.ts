import { indentWithTab } from '@codemirror/commands';
import { Compartment, EditorState, StateEffect } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { basicSetup, EditorView } from 'codemirror';
import mermaid from 'mermaid';
import 'remixicon/fonts/remixicon.css';

import { createMermaidLanguage } from './editor/language';
import { createEditorTheme } from './editor/theme';
import {
  createEditorZoomController,
  createEditorZoomExtension,
  createEditorZoomKeymap,
} from './editor/zoom';
import { setupHelpDialog } from './help/dialog';
import { createPreview } from './preview/render';
import {
  createZoomController,
  setupWheelZoom,
  setupZoomControls,
  updateLevelDisplay,
} from './preview/zoom';
import { setupToolbarActions } from './toolbar/actions';
import { setupToolbarShortcuts } from './toolbar/shortcuts';
import {
  loadEditorZoom,
  loadSettingsStore,
  saveEditorZoom,
  setupWindowPersistence,
} from './window/state';
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
  const statusFile = document.querySelector<HTMLSpanElement>('[data-status="file"]');
  const workspace = document.querySelector<HTMLDivElement>('.workspace');
  const editorPane = document.querySelector<HTMLElement>('[data-pane="editor"]');
  const previewPane = document.querySelector<HTMLElement>('[data-pane="preview"]');
  const divider = document.querySelector<HTMLDivElement>('.divider');
  const zoomInBtn = document.querySelector<HTMLButtonElement>('[data-action="zoom-in"]');
  const zoomOutBtn = document.querySelector<HTMLButtonElement>('[data-action="zoom-out"]');
  const zoomResetBtn = document.querySelector<HTMLButtonElement>('[data-action="zoom-reset"]');
  const zoomLevelDisplay = document.querySelector<HTMLSpanElement>('[data-zoom-level]');
  const helpButton = document.querySelector<HTMLButtonElement>('[data-action="help"]');

  if (!host || !previewElement) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
  });

  const appWindow = getCurrentWindow();
  const store = await loadSettingsStore();

  const zoomController = createZoomController(previewElement, (level) => {
    if (zoomLevelDisplay) {
      updateLevelDisplay(zoomLevelDisplay, level);
    }
  });

  setupZoomControls(zoomController, zoomInBtn, zoomOutBtn, zoomResetBtn, zoomLevelDisplay);
  if (previewPane) {
    setupWheelZoom(previewPane, zoomController);
  }

  if (store) {
    await setupWindowPersistence(store, appWindow, WINDOW_PERSIST_DELAY);
  }

  const status = createStatusController(statusMessage);
  const fileStatus = createFileStatusController(statusFile);

  let lastCommittedDoc = DEFAULT_SNIPPET;
  let isDocumentDirty = false;
  let lastSavedAt: Date | null = null;
  let currentFilePath: string | null = null;

  const updateFileStatus = () => {
    fileStatus.update({
      path: currentFilePath,
      dirty: isDocumentDirty,
      lastSavedAt,
    });
  };

  const schedulePreviewRender = createPreview(previewElement, RENDER_DELAY, {
    onRenderStart() {
      status.rendering();
    },
    onRenderSuccess() {
      status.success('Preview updated successfully');
      zoomController.applyZoom();
    },
    onRenderEmpty() {
      status.info('Waiting for Mermaid markup...');
    },
    onRenderError(details) {
      status.error(details);
    },
  });
  const handleDocChange = (doc: string) => {
    isDocumentDirty = doc !== lastCommittedDoc;
    updateFileStatus();
  };

  const commitDocument = (doc: string, options?: { saved?: boolean }) => {
    lastCommittedDoc = doc;
    isDocumentDirty = false;
    if (options?.saved) {
      lastSavedAt = new Date();
    } else if (!currentFilePath) {
      lastSavedAt = null;
    }
    updateFileStatus();
  };

  const { extension: zoomExtension, compartment: zoomCompartment } = createEditorZoomExtension();
  const editor = createEditor(
    host,
    DEFAULT_SNIPPET,
    schedulePreviewRender,
    handleDocChange,
    zoomExtension
  );

  const savedEditorZoom = store ? await loadEditorZoom(store) : null;
  const editorZoomController = createEditorZoomController(
    editor,
    zoomCompartment,
    (level) => {
      if (store) {
        saveEditorZoom(store, level);
      }
    },
    savedEditorZoom ?? undefined
  );
  editor.dispatch({
    effects: StateEffect.appendConfig.of(createEditorZoomKeymap(editorZoomController)),
  });

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
      const previousPath = currentFilePath;
      currentFilePath = path;
      if (path === null) {
        lastSavedAt = null;
      } else if (path !== previousPath) {
        lastSavedAt = null;
      }
      updateFileStatus();
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

  setupHelpDialog(helpButton);
}

function createEditor(
  host: HTMLElement,
  initialDoc: string,
  schedulePreviewRender: (doc: string) => void,
  onDocChange?: (doc: string) => void,
  zoomExtension?: ReturnType<Compartment['of']>
): EditorView {
  const extensions = [
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
  ];

  if (zoomExtension) {
    extensions.push(zoomExtension);
  }

  const state = EditorState.create({
    doc: initialDoc,
    extensions,
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
  const noop = () => {
    /* intentionally empty */
  };
  if (!element) {
    return {
      idle: noop,
      rendering: noop,
      success: noop,
      info: noop,
      error: noop,
    };
  }

  const target = element;

  const defaultMessage = (target.textContent || 'Ready.').trim() || 'Ready.';
  let revertTimer: number | null = null;

  function setStatus(message: string, level: StatusLevel, autoRevert = false): void {
    if (revertTimer !== null) {
      window.clearTimeout(revertTimer);
      revertTimer = null;
    }
    target.textContent = message;
    target.dataset.statusLevel = level;
    if (autoRevert) {
      revertTimer = window.setTimeout(() => {
        target.textContent = defaultMessage;
        target.dataset.statusLevel = 'idle';
        revertTimer = null;
      }, 4000);
    }
  }

  setStatus(defaultMessage, 'idle');

  return {
    idle(message) {
      setStatus(message ?? defaultMessage, 'idle');
    },
    rendering(message = 'Rendering preview...') {
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

interface FileStatusState {
  path: string | null;
  dirty: boolean;
  lastSavedAt: Date | null;
}

function createFileStatusController(element: HTMLSpanElement | null): {
  update(state: FileStatusState): void;
} {
  const noop = () => {
    /* intentionally empty */
  };
  if (!element) {
    return {
      update: noop,
    };
  }

  const formatName = (path: string | null): string => {
    if (!path) {
      return 'Untitled';
    }
    const normalized = path.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return {
    update(state) {
      const { path, dirty, lastSavedAt } = state;
      const name = formatName(path);

      let details: string;
      if (dirty) {
        details = 'Unsaved changes';
      } else if (lastSavedAt) {
        details = `Saved ${formatTime(lastSavedAt)}`;
      } else if (path) {
        details = 'Opened from disk';
      } else {
        details = 'Not saved yet';
      }

      element.textContent = `${name} - ${details}`;
      element.dataset.dirty = dirty ? 'true' : 'false';

      const savedInfo = lastSavedAt ? `Last saved: ${lastSavedAt.toLocaleString()}` : null;
      if (path && savedInfo) {
        element.title = `${path}\n${savedInfo}`;
      } else if (path) {
        element.title = path;
      } else if (savedInfo) {
        element.title = savedInfo;
      } else {
        element.title = 'Unsaved diagram';
      }
    },
  };
}
