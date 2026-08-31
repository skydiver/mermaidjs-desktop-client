// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAIChat } from '../../src/hooks/useAIChat';
import {
  DEFAULT_SETTINGS,
  SettingsContext,
  type SettingsContextValue,
} from '../../src/hooks/useSettings';
import type { AiStreamChunk } from '../../src/lib/ai/types';

// ── Mocks for the dynamic Tauri imports ────────────────

const invokeMock = vi.fn();
let listenCallback: ((event: { payload: AiStreamChunk }) => void) | null = null;

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName: string, cb: (event: { payload: AiStreamChunk }) => void) => {
    if (eventName === 'ai-stream') listenCallback = cb;
    return Promise.resolve(() => {
      listenCallback = null;
    });
  }),
}));

// ── Test harness ────────────────────────────────────────

function makeSettings(overrides?: Partial<SettingsContextValue['settings']>): SettingsContextValue {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      ...overrides,
      ai: {
        activeProvider: 'anthropic',
        providers: {
          ...DEFAULT_SETTINGS.ai.providers,
          anthropic: { model: 'claude-sonnet-4-5' },
        },
      },
    },
    isDiagramDark: false,
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
  };
}

function wrapperFor(contextValue: SettingsContextValue) {
  return ({ children }: { children: ReactNode }) =>
    createElement(SettingsContext.Provider, { value: contextValue }, children);
}

/** Extracts the `streamId` the hook generated for the most recent `send_ai_message` call. */
function lastStreamId(): string {
  const calls = invokeMock.mock.calls.filter((c) => c[0] === 'send_ai_message');
  const call = calls[calls.length - 1];
  if (!call) throw new Error('send_ai_message was never invoked');
  return (call[1] as { streamId: string }).streamId;
}

async function waitForListener() {
  await waitFor(() => expect(listenCallback).not.toBeNull());
}

async function waitForSend() {
  await waitFor(() =>
    expect(invokeMock.mock.calls.some((c) => c[0] === 'send_ai_message')).toBe(true)
  );
}

function emit(chunk: AiStreamChunk) {
  act(() => {
    listenCallback?.({ payload: chunk });
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(undefined);
  listenCallback = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────

describe('useAIChat', () => {
  it('applies the extracted mermaid block to the editor when the stream completes', async () => {
    let editorContent = 'graph TD\nA --> B';
    const getDiagramSource = vi.fn(() => editorContent);
    const applySuggestion = vi.fn((source: string) => {
      editorContent = source;
    });

    const { result } = renderHook(() => useAIChat({ getDiagramSource, applySuggestion }), {
      wrapper: wrapperFor(makeSettings()),
    });

    await waitForListener();

    act(() => result.current.send('draw a flowchart'));
    await waitForSend();
    const streamId = lastStreamId();

    emit({ type: 'text-delta', streamId, text: 'Sure, here:\n```mermaid\n' });
    emit({ type: 'text-delta', streamId, text: 'graph TD\nC --> D\n```' });
    emit({ type: 'done', streamId, tokensIn: 10, tokensOut: 20 });

    expect(applySuggestion).toHaveBeenCalledWith('graph TD\nC --> D');
    expect(editorContent).toBe('graph TD\nC --> D');
    expect(result.current.pendingSuggestion).not.toBeNull();
    expect(result.current.pendingSuggestion?.previousContent).toBe('graph TD\nA --> B');
    expect(result.current.isStreaming).toBe(false);
  });

  it('cancelPending restores the pre-suggestion snapshot', async () => {
    let editorContent = 'original diagram';
    const getDiagramSource = vi.fn(() => editorContent);
    const applySuggestion = vi.fn((source: string) => {
      editorContent = source;
    });

    const { result } = renderHook(() => useAIChat({ getDiagramSource, applySuggestion }), {
      wrapper: wrapperFor(makeSettings()),
    });

    await waitForListener();

    act(() => result.current.send('draw a flowchart'));
    await waitForSend();
    const streamId = lastStreamId();

    emit({ type: 'text-delta', streamId, text: '```mermaid\ngraph TD\nX --> Y\n```' });
    emit({ type: 'done', streamId, tokensIn: 1, tokensOut: 1 });

    expect(editorContent).toBe('graph TD\nX --> Y');
    expect(result.current.pendingSuggestion).not.toBeNull();

    act(() => result.current.cancelPending());

    expect(editorContent).toBe('original diagram');
    expect(applySuggestion).toHaveBeenLastCalledWith('original diagram');
    expect(result.current.pendingSuggestion).toBeNull();
  });

  it('notifyUserEdit clears a pending suggestion (implicit accept) without reverting the editor', async () => {
    let editorContent = 'original diagram';
    const getDiagramSource = vi.fn(() => editorContent);
    const applySuggestion = vi.fn((source: string) => {
      editorContent = source;
    });

    const { result } = renderHook(() => useAIChat({ getDiagramSource, applySuggestion }), {
      wrapper: wrapperFor(makeSettings()),
    });

    await waitForListener();

    act(() => result.current.send('draw a flowchart'));
    await waitForSend();
    const streamId = lastStreamId();

    emit({ type: 'text-delta', streamId, text: '```mermaid\ngraph TD\nX --> Y\n```' });
    emit({ type: 'done', streamId, tokensIn: 1, tokensOut: 1 });

    expect(result.current.pendingSuggestion).not.toBeNull();
    const callsBefore = applySuggestion.mock.calls.length;

    // Simulate the orchestrator calling notifyUserEdit() for a real keystroke.
    act(() => result.current.notifyUserEdit());

    expect(result.current.pendingSuggestion).toBeNull();
    expect(editorContent).toBe('graph TD\nX --> Y'); // Unchanged — no revert.
    expect(applySuggestion).toHaveBeenCalledTimes(callsBefore); // No extra write.
  });

  it('drops text-delta chunks whose streamId does not match the current stream', async () => {
    const getDiagramSource = vi.fn(() => 'original');
    const applySuggestion = vi.fn();

    const { result } = renderHook(() => useAIChat({ getDiagramSource, applySuggestion }), {
      wrapper: wrapperFor(makeSettings()),
    });

    await waitForListener();

    act(() => result.current.send('draw a flowchart'));

    emit({ type: 'text-delta', streamId: 'a-stale-stream-id', text: 'should be ignored' });

    const assistantMessage = result.current.messages.find((m) => m.role === 'assistant');
    expect(assistantMessage?.content).toBe('');
  });

  it('applies nothing when the reply has no mermaid block (conversational reply)', async () => {
    const getDiagramSource = vi.fn(() => 'original diagram');
    const applySuggestion = vi.fn();

    const { result } = renderHook(() => useAIChat({ getDiagramSource, applySuggestion }), {
      wrapper: wrapperFor(makeSettings()),
    });

    await waitForListener();

    act(() => result.current.send('what does this diagram do?'));
    await waitForSend();
    const streamId = lastStreamId();

    emit({ type: 'text-delta', streamId, text: 'This is a simple flowchart with two nodes.' });
    emit({ type: 'done', streamId, tokensIn: 5, tokensOut: 10 });

    expect(applySuggestion).not.toHaveBeenCalled();
    expect(result.current.pendingSuggestion).toBeNull();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages.find((m) => m.role === 'assistant')?.content).toBe(
      'This is a simple flowchart with two nodes.'
    );
  });
});
