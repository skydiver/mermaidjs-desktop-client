import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import mermaid from "mermaid";
import { Store } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { indentWithTab } from "@codemirror/commands";

const DEFAULT_SNIPPET = `graph TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- Not yet --> D[Keep iterating]`;
const RENDER_DELAY = 300;
const WINDOW_PERSIST_DELAY = 400;
const SETTINGS_STORE_NAME = "settings.store";
const WINDOW_STATE_KEY = "windowState";
let renderCounter = 0;
const MERMAID_KEYWORDS = new Set([
  "graph",
  "flowchart",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "erDiagram",
  "journey",
  "gantt",
  "pie",
  "mindmap",
  "timeline",
  "gitGraph",
  "quadrantChart",
  "requirementDiagram",
  "subgraph",
  "end",
  "click",
  "linkStyle",
  "style",
  "class",
  "direction",
  "tb",
  "td",
  "lr",
  "rl",
  "bt",
  "note",
  "rect",
  "call",
  "section",
  "loop",
  "alt",
  "opt",
  "par",
  "and",
]);

const mermaidMode = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) {
      return null;
    }

    if (stream.match("%%")) {
      stream.skipToEnd();
      return "comment";
    }

    if (stream.peek() === '"' || stream.peek() === "'") {
      const quote = stream.next();
      let escaped = false;
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === quote && !escaped) {
          break;
        }
        escaped = !escaped && ch === "\\";
      }
      return "string";
    }

    if (stream.match(/[#.][A-Za-z_][\w-]*/)) {
      return "attributeName";
    }

    if (
      stream.match(/--?>|<--?|==>|<==|-\.-|\.->|==/) ||
      stream.match(/:::/)
    ) {
      return "operator";
    }

    if (stream.match(/[{}\[\]()]/)) {
      return "bracket";
    }

    if (stream.match(/[-+*/=<>!]+/)) {
      return "operator";
    }

    if (stream.match(/\d+(\.\d+)?/)) {
      return "number";
    }

    if (stream.match(/[A-Za-z_][\w-]*/)) {
      const word = stream.current().toLowerCase();
      if (MERMAID_KEYWORDS.has(word)) {
        return "keyword";
      }
      return "variableName";
    }

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: "%%" },
    closeBrackets: { brackets: "()[]{}\"'`" },
  },
});

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

async function persistWindowState(store, appWindow) {
  try {
    const [size, position, maximized] = await Promise.all([
      appWindow.outerSize(),
      appWindow.outerPosition(),
      appWindow.isMaximized(),
    ]);

    const windowState = {
      width: size ? Math.round(size.width) : undefined,
      height: size ? Math.round(size.height) : undefined,
      x: position ? Math.round(position.x) : undefined,
      y: position ? Math.round(position.y) : undefined,
      maximized: Boolean(maximized),
    };

    await store.set(WINDOW_STATE_KEY, windowState);
    await store.save();
  } catch (error) {
    console.warn("Persisting window state failed", error);
  }
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

window.addEventListener("DOMContentLoaded", async () => {
  const host = document.querySelector("#editor-host");
  const preview = document.querySelector("#preview-host");

  if (!host || !preview) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
  });

  const appWindow = getCurrentWindow();
  let store;
  try {
    store = await Store.load(SETTINGS_STORE_NAME);
  } catch (error) {
    console.error("Failed to load settings store", error);
  }

  if (store) {
    const debouncedPersist = debounce(
      () => persistWindowState(store, appWindow),
      WINDOW_PERSIST_DELAY
    );

    const unlistenResize = await appWindow.onResized(() => debouncedPersist());
    const unlistenMove = await appWindow.onMoved(() => debouncedPersist());

    await appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      await persistWindowState(store, appWindow);
      if (typeof unlistenResize === "function") {
        unlistenResize();
      }
      if (typeof unlistenMove === "function") {
        unlistenMove();
      }
      await appWindow.close();
    });
  }

  const scheduleRender = debounce((doc) => {
    const token = ++renderCounter;
    renderMermaid(doc, preview, token);
  }, RENDER_DELAY);

  const state = EditorState.create({
    doc: DEFAULT_SNIPPET,
    extensions: [
      basicSetup,
      mermaidMode,
      EditorView.lineWrapping,
      EDITOR_THEME,
      keymap.of([indentWithTab]),
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

  view.focus();

  host.dataset.editor = "mounted";
  preview.dataset.preview = "ready";
  scheduleRender(view.state.doc.toString());
});
