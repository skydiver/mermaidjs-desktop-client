import { indentWithTab } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { basicSetup, EditorView } from 'codemirror';
import mermaid from 'mermaid';

import { createMermaidLanguage } from './editor/language';
import { createEditorTheme } from './editor/theme';
import { createPreview } from './preview/render';
import { loadSettingsStore, setupWindowPersistence } from './window/state';

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

  editor.focus();
  host.dataset.editor = 'mounted';
  previewElement.dataset.preview = 'ready';
  schedulePreviewRender(editor.state.doc.toString());
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
