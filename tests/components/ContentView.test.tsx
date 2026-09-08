// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContentView from '../../src/components/ContentView';
import { DEFAULT_SETTINGS, SettingsContext } from '../../src/hooks/useSettings';

// jsdom does not implement ResizeObserver, and has no layout to feed one even
// if it did. This stub stands in for both: it reports `stubbedWidth` to every
// observer on `observe`, and `resizeTo` re-reports a new width — which is how
// the tests below simulate the split shrinking as the AI panel widens.
let stubbedWidth = 0;
const observerCallbacks = new Set<ResizeObserverCallback>();

class ResizeObserverStub {
  constructor(private callback: ResizeObserverCallback) {
    observerCallbacks.add(callback);
  }
  observe() {
    this.report();
  }
  unobserve() {
    // Single-element observers here; nothing to track per element.
  }
  disconnect() {
    observerCallbacks.delete(this.callback);
  }
  private report() {
    this.callback(
      [{ contentRect: { width: stubbedWidth } } as ResizeObserverEntry],
      this as unknown as ResizeObserver
    );
  }
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

function resizeTo(width: number) {
  stubbedWidth = width;
  act(() => {
    for (const callback of observerCallbacks) {
      callback([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
    }
  });
}

// The editor and preview are heavyweight (CodeMirror, Mermaid) and irrelevant
// to what this file asserts — which pane exists at all. The AI panel is stubbed
// for the same reason: its own behaviour is covered by useAIChat's tests, while
// what matters here is purely whether ContentView mounts it.
vi.mock('../../src/components/EditorView', () => ({
  default: () => <div data-testid="editor" />,
}));
vi.mock('../../src/components/PreviewView', () => ({
  default: () => <div data-testid="preview" />,
}));
vi.mock('../../src/components/AIPanel', () => ({
  default: () => <div data-testid="ai-panel" />,
}));

const aiChat = {
  messages: [],
  isStreaming: false,
  pendingSuggestion: null,
  error: null,
  send: vi.fn(),
  stop: vi.fn(),
  retry: vi.fn(),
  acceptPending: vi.fn(),
  cancelPending: vi.fn(),
  notifyUserEdit: vi.fn(),
  reset: vi.fn(),
};

function renderContentView(overrides: {
  hasDocument: boolean;
  showAIPanel: boolean;
  splitWidth?: number;
}) {
  const { splitWidth = 0, ...props } = overrides;
  stubbedWidth = splitWidth;
  return render(
    <SettingsContext.Provider
      value={{
        settings: DEFAULT_SETTINGS,
        isDiagramDark: false,
        updateSettings: vi.fn(),
        resetSettings: vi.fn(),
      }}
    >
      <ContentView
        editorRef={{ current: null }}
        editorText=""
        onEditorChange={vi.fn()}
        fileName={null}
        isDirty={false}
        lastSavedAt={null}
        statusMessage="Ready"
        statusLevel="idle"
        hasContent={false}
        onPreviewStatusChange={vi.fn()}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onSaveFile={vi.fn()}
        onSelectExample={vi.fn()}
        onExport={vi.fn()}
        onOpenHelp={vi.fn()}
        onOpenSettings={vi.fn()}
        aiChat={aiChat}
        onAiSend={vi.fn()}
        onToggleAIPanel={vi.fn()}
        onOpenAiSettings={vi.fn()}
        {...props}
      />
    </SettingsContext.Provider>
  );
}

describe('ContentView AI panel', () => {
  it('mounts the AI panel when a document is open', () => {
    renderContentView({ hasDocument: true, showAIPanel: true });
    expect(screen.getByTestId('ai-panel')).toBeDefined();
  });

  // Generating a diagram from nothing is the feature's primary flow, so the
  // panel must be reachable from the empty state — where there is no document
  // yet. It previously lived inside the `hasDocument` branch, so toggling it
  // there rendered nothing at all.
  it('mounts the AI panel from the empty state, with no document open', () => {
    renderContentView({ hasDocument: false, showAIPanel: true });
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(screen.getByTestId('ai-panel')).toBeDefined();
  });
});

describe('ContentView editor/preview split', () => {
  // Opening or widening the AI panel narrows the split, which used to narrow
  // the editor with it because the editor's width was recomputed as a fraction
  // of the split on every render. Only the preview should give up the space.
  it('keeps the editor at its pixel width when the split narrows', () => {
    renderContentView({ hasDocument: true, showAIPanel: false, splitWidth: 1600 });
    const editorPane = screen.getByTestId('editor').parentElement;
    const initialWidth = editorPane?.style.width;
    expect(initialWidth).toBe('640px'); // 1600 * DEFAULT_RATIO

    resizeTo(1040); // A 560px AI panel opens.

    expect(editorPane?.style.width).toBe(initialWidth);
  });

  // The editor cannot hold its width unconditionally: past a point there would
  // be no preview left to shrink, so it yields to keep the preview's floor.
  it('gives up width once the preview has hit its floor', () => {
    renderContentView({ hasDocument: true, showAIPanel: false, splitWidth: 1600 });
    const editorPane = screen.getByTestId('editor').parentElement;

    resizeTo(700); // 700 - 240 (preview floor) = 460 left for the editor.

    expect(editorPane?.style.width).toBe('460px');
  });
});
