// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContentView from '../../src/components/ContentView';
import { DEFAULT_SETTINGS, SettingsContext } from '../../src/hooks/useSettings';

// jsdom does not implement ResizeObserver, which ContentView uses to keep the
// AI panel's proportional maximum in step with the window. A no-op stub is
// enough: these tests assert which panes mount, not how they are sized.
class ResizeObserverStub {
  observe() {
    // Never fires: jsdom has no layout, so there is no size change to report.
  }
  unobserve() {
    // Nothing was ever observed.
  }
  disconnect() {
    // Nothing to release.
  }
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

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
  acceptPending: vi.fn(),
  cancelPending: vi.fn(),
  notifyUserEdit: vi.fn(),
  reset: vi.fn(),
};

function renderContentView(overrides: { hasDocument: boolean; showAIPanel: boolean }) {
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
        {...overrides}
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
