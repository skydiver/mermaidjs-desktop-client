import { indentWithTab } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { EditorView, basicSetup } from "codemirror";
import mermaid from "mermaid";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Store } from "@tauri-apps/plugin-store";

const DEFAULT_SNIPPET = `graph TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- Not yet --> D[Keep iterating]`;

const RENDER_DELAY = 300;
const WINDOW_PERSIST_DELAY = 400;
const SETTINGS_STORE_NAME = "settings.store";
const WINDOW_STATE_KEY = "windowState";

const MERMAID_KEYWORDS = [
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
];

const MERMAID_LANGUAGE = createMermaidLanguage();
const EDITOR_THEME = createEditorTheme();

window.addEventListener("DOMContentLoaded", bootstrap);

async function bootstrap() {
  const host = document.querySelector("#editor-host");
  const previewElement = document.querySelector("#preview-host");
  if (!host || !previewElement) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
  });

  const appWindow = getCurrentWindow();
  const store = await loadSettingsStore();

  if (store) {
    await setupWindowPersistence(store, appWindow);
  }

  const schedulePreviewRender = createPreview(previewElement);
  const editor = createEditor(host, DEFAULT_SNIPPET, schedulePreviewRender);

  editor.focus();
  host.dataset.editor = "mounted";
  previewElement.dataset.preview = "ready";
  schedulePreviewRender(editor.state.doc.toString());
}

function createEditor(host, initialDoc, schedulePreviewRender) {
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

function createPreview(previewEl) {
  let latestToken = 0;
  const debouncedRender = debounce(async (source, token) => {
    if (token !== latestToken) {
      return;
    }

    const trimmed = source.trim();
    if (!trimmed.length) {
      showPreviewMessage(previewEl, "Add Mermaid markup to see the preview.");
      return;
    }

    try {
      const renderId = `mermaid-${Date.now()}-${token}`;
      const { svg } = await mermaid.render(renderId, trimmed);
      if (token !== latestToken) {
        return;
      }
      previewEl.classList.remove("preview-empty", "preview-error");
      previewEl.innerHTML = svg;
    } catch (error) {
      console.error("Mermaid render failed", error);
      showPreviewError(
        previewEl,
        "Mermaid could not render this diagram.",
        (error?.message || error || "Unknown error").toString()
      );
    }
  }, RENDER_DELAY);

  return (source) => {
    latestToken += 1;
    const currentToken = latestToken;
    debouncedRender(source, currentToken);
  };
}

function showPreviewMessage(previewEl, message) {
  previewEl.classList.add("preview-empty");
  previewEl.classList.remove("preview-error");

  const paragraph = document.createElement("p");
  paragraph.className = "preview-message";
  paragraph.textContent = message;
  previewEl.replaceChildren(paragraph);
}

function showPreviewError(previewEl, message, details) {
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

async function loadSettingsStore() {
  try {
    return await Store.load(SETTINGS_STORE_NAME);
  } catch (error) {
    console.error("Failed to load settings store", error);
    return null;
  }
}

async function setupWindowPersistence(store, appWindow) {
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

function createMermaidLanguage() {
  const keywordSet = new Set(MERMAID_KEYWORDS.map((word) => word.toLowerCase()));
  const arrowPattern = /--?>|<--?|==>|<==|-\.-|\.->|==/;
  const operatorPattern = /[-+*/=<>!]+/;

  return StreamLanguage.define({
    token(stream) {
      if (stream.eatSpace()) {
        return null;
      }

      if (stream.match("%%")) {
        stream.skipToEnd();
        return "comment";
      }

      const next = stream.peek();
      if (next === '"' || next === "'") {
        readQuoted(stream, stream.next());
        return "string";
      }

      if (stream.match(/[#.][A-Za-z_][\w-]*/)) {
        return "attributeName";
      }

      if (stream.match(arrowPattern) || stream.match(/:::/)) {
        return "operator";
      }

      if (stream.match(/[{}\[\]()]/)) {
        return "bracket";
      }

      if (stream.match(operatorPattern)) {
        return "operator";
      }

      if (stream.match(/\d+(\.\d+)?/)) {
        return "number";
      }

      if (stream.match(/[A-Za-z_][\w-]*/)) {
        const word = stream.current().toLowerCase();
        return keywordSet.has(word) ? "keyword" : "variableName";
      }

      stream.next();
      return null;
    },
    languageData: {
      commentTokens: { line: "%%" },
      closeBrackets: { brackets: "()[]{}\"'`" },
    },
  });
}

function readQuoted(stream, quote) {
  let escaped = false;
  while (!stream.eol()) {
    const ch = stream.next();
    if (ch === quote && !escaped) {
      return;
    }
    escaped = !escaped && ch === "\\";
  }
}

function createEditorTheme() {
  return EditorView.theme({
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
}

function debounce(fn, wait) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), wait);
  };
}
