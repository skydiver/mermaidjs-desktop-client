import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import mermaid from "mermaid";

const DEFAULT_SNIPPET = `graph TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- Not yet --> D[Keep iterating]`;
const RENDER_DELAY = 300;
let renderCounter = 0;

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

function debounce(fn, wait) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), wait);
  };
}

function setPreviewMessage(previewEl, message) {
  previewEl.classList.add("preview-empty");
  previewEl.classList.remove("preview-error");

  const paragraph = document.createElement("p");
  paragraph.className = "preview-message";
  paragraph.textContent = message;

  previewEl.replaceChildren(paragraph);
}

function setPreviewError(previewEl, message, details) {
  previewEl.classList.remove("preview-empty");
  previewEl.classList.add("preview-error");

  const container = document.createElement("div");
  const heading = document.createElement("p");
  heading.className = "preview-message";
  heading.textContent = message;

  const pre = document.createElement("pre");
  pre.textContent = details;

  container.append(heading, pre);
  previewEl.replaceChildren(container);
}

async function renderMermaid(source, previewEl, token) {
  if (!previewEl) return;

  if (token !== undefined && token !== renderCounter) {
    return;
  }

  const trimmed = source.trim();
  if (!trimmed.length) {
    setPreviewMessage(previewEl, "Add Mermaid markup to see the preview.");
    return;
  }

  try {
    const renderId = `mermaid-diagram-${Date.now()}`;
    const { svg } = await mermaid.render(renderId, trimmed);
    if (token !== renderCounter) {
      return;
    }
    previewEl.classList.remove("preview-empty", "preview-error");
    previewEl.innerHTML = svg;
  } catch (error) {
    console.error("Mermaid render failed", error);
    setPreviewError(
      previewEl,
      "Mermaid could not render this diagram.",
      (error?.message || error || "Unknown error").toString()
    );
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const host = document.querySelector("#editor-host");
  const preview = document.querySelector("#preview-host");

  if (!host || !preview) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
  });

  const scheduleRender = debounce((doc) => {
    const token = ++renderCounter;
    renderMermaid(doc, preview, token);
  }, RENDER_DELAY);

  const state = EditorState.create({
    doc: DEFAULT_SNIPPET,
    extensions: [
      basicSetup,
      markdown(),
      EditorView.lineWrapping,
      EDITOR_THEME,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          scheduleRender(update.state.doc.toString());
        }
      }),
    ],
  });

  const view = new EditorView({
    parent: host,
    state,
  });

  host.dataset.editor = "mounted";
  preview.dataset.preview = "ready";
  scheduleRender(view.state.doc.toString());

  window.__editorView = view;
});
