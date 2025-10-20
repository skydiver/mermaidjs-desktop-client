import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";

const DEFAULT_SNIPPET = `graph TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- Not yet --> D[Keep iterating]`;

const EDITOR_THEME = EditorView.theme({
  "&": {
    borderRadius: "8px",
    border: "1px solid var(--editor-border)",
    backgroundColor: "var(--editor-bg)",
    color: "inherit",
    boxShadow: "inset 0 1px 3px rgba(15, 23, 42, 0.08)",
    minHeight: "100%",
  },
  ".cm-scroller": {
    fontFamily:
      '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace',
    lineHeight: "1.5",
  },
  ".cm-content": {
    caretColor: "var(--editor-caret)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--editor-gutter)",
  },
});

window.addEventListener("DOMContentLoaded", () => {
  const host = document.querySelector("#editor-host");
  if (!host) {
    return;
  }

  const state = EditorState.create({
    doc: DEFAULT_SNIPPET,
    extensions: [basicSetup, markdown(), EditorView.lineWrapping, EDITOR_THEME],
  });

  const view = new EditorView({
    parent: host,
    state,
  });

  host.dataset.editor = "mounted";
  window.__editorView = view;
});
