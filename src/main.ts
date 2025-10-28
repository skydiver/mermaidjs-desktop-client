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
  const exportButton = document.querySelector<HTMLButtonElement>('[data-action="export-menu"]');
  const exportMenu = document.querySelector<HTMLDivElement>(
    '[data-dropdown="export"] .toolbar-menu'
  );
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

  const schedulePreviewRender = createPreview(previewElement, RENDER_DELAY);
  const editor = createEditor(host, DEFAULT_SNIPPET, schedulePreviewRender);
  let currentFilePath: string | null = null;

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
    onPathChange(path) {
      currentFilePath = path;
    },
    getPath() {
      return currentFilePath;
    },
    defaultSnippet: DEFAULT_SNIPPET,
  });
}

function createEditor(
  host: HTMLElement,
  initialDoc: string,
  schedulePreviewRender: (doc: string) => void
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
          schedulePreviewRender(update.state.doc.toString());
        }
      }),
    ],
  });

  return new EditorView({
    parent: host,
    state,
  });
}
