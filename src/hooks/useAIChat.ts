import { useCallback, useEffect, useRef, useState } from 'react';
import { extractMermaid } from '../lib/ai/extract-mermaid';
import type { AiMessage, AiProviderConfig, AiStreamChunk } from '../lib/ai/types';
import { manageAsyncResource } from '../lib/async-resource';
import { useSettings } from './useSettings';

// ── Types ───────────────────────────────────────────────

/**
 * A suggestion the assistant applied to the editor, awaiting the user's
 * Apply/Cancel decision. `messageId` identifies the assistant bubble that
 * carries the Apply/Cancel controls — only the newest assistant message
 * can be pending, since a new `send()` (or a fresh apply) always replaces
 * whatever was pending before it.
 */
export interface PendingSuggestion {
  messageId: string;
  /** Editor content immediately before this suggestion was applied, so `cancelPending` can restore it exactly. */
  previousContent: string;
}

export interface UseAIChatOptions {
  /** Reads the diagram source currently in the editor. */
  getDiagramSource: () => string;
  /**
   * Writes `source` into the editor. Must mark the document dirty like any
   * other content change, but must NOT be treated as a hand-edit — see
   * `notifyUserEdit` below for how the hook protects against that.
   */
  applySuggestion: (source: string) => void;
}

export interface UseAIChatReturn {
  messages: AiMessage[];
  isStreaming: boolean;
  pendingSuggestion: PendingSuggestion | null;
  error: string | null;
  send: (text: string) => void;
  stop: () => void;
  acceptPending: () => void;
  cancelPending: () => void;
  notifyUserEdit: () => void;
  reset: () => void;
}

// ── Helpers ─────────────────────────────────────────────

function newId(): string {
  // `crypto.randomUUID` is available in both the Tauri webview and plain
  // browser dev — no dependency needed for id generation.
  return crypto.randomUUID();
}

function isConfigured(config: AiProviderConfig | undefined): config is AiProviderConfig {
  return !!config && config.model.trim().length > 0;
}

// ── Hook ────────────────────────────────────────────────

export function useAIChat({
  getDiagramSource,
  applySuggestion,
}: UseAIChatOptions): UseAIChatReturn {
  const { settings } = useSettings();

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mirrors of state for use inside stable callbacks (event handler, send)
  // without re-subscribing the listener or re-creating callbacks on every
  // message — same pattern as `isDirtyRef`/`filePathRef` in useFileHandling.
  const messagesRef = useRef<AiMessage[]>(messages);
  messagesRef.current = messages;
  const isStreamingRef = useRef(false);
  isStreamingRef.current = isStreaming;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Identity of the stream currently being awaited. `text-delta`/`done`/
  // `error` events carry the `streamId` they belong to — any event whose id
  // doesn't match this ref is stale (a cancelled or superseded stream still
  // in flight) and must be dropped, mirroring `tokenRef` in useMermaid.ts.
  const currentStreamIdRef = useRef<string | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);

  // The reply accumulated so far for the in-flight stream. `done` must not
  // recover the final text from `messagesRef`, which only refreshes on
  // render: a `done` event arriving before React has flushed the last
  // `text-delta` would yield a truncated reply, and a Mermaid block cut
  // short parses as a different (or invalid) diagram rather than failing
  // loudly. Appending here as chunks arrive makes the final text
  // independent of render timing.
  const streamTextRef = useRef('');

  // Mirror of `pendingSuggestion` so `cancelPending` can read it without
  // performing the editor write inside a state updater — updaters must stay
  // pure, and StrictMode double-invokes them.
  const pendingSuggestionRef = useRef<PendingSuggestion | null>(null);
  pendingSuggestionRef.current = pendingSuggestion;

  // Set synchronously around the hook's own `applySuggestion` calls (accept
  // preview / cancel restore) so `notifyUserEdit` — fired by the orchestrator
  // on every editor change, hook-caused or not — can tell its own writes
  // apart from a real keystroke. Same shape as `suppressDirtyRef` in
  // useFileHandling.ts.
  const isApplyingRef = useRef(false);

  const applySuggestionInternal = useCallback(
    (source: string) => {
      isApplyingRef.current = true;
      applySuggestion(source);
      // If `source` is identical to the editor's current content, the
      // orchestrator's change handler never fires (a no-op write dispatches
      // nothing), so nothing would consume the flag — clear it here too,
      // matching the no-op-replacement guard in useFileHandling's
      // `replaceContent`, so a stale flag can never swallow the next real
      // user edit.
      isApplyingRef.current = false;
    },
    [applySuggestion]
  );

  const notifyUserEdit = useCallback(() => {
    if (isApplyingRef.current) {
      isApplyingRef.current = false;
      return;
    }
    setPendingSuggestion(null);
  }, []);

  // ── Stream lifecycle ────────────────────────────────

  const finalizeStream = useCallback(() => {
    currentStreamIdRef.current = null;
    currentAssistantIdRef.current = null;
    setIsStreaming(false);
  }, []);

  /** Cancels whatever stream is currently in flight, if any. Used by both `stop()` and `send()` (which must not let a previous stream keep writing into a bubble it no longer owns). */
  const cancelInFlight = useCallback(async () => {
    if (!isStreamingRef.current) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cancel_ai_stream');
    } catch {
      // Not in Tauri, or the cancel call itself failed — either way there is
      // nothing more to stream, so the local state is finalized below
      // regardless of whether the backend was actually told to stop.
    }
    finalizeStream();
  }, [finalizeStream]);

  const stop = useCallback(() => {
    void cancelInFlight();
  }, [cancelInFlight]);

  const applyPendingFromReply = useCallback(
    (assistantId: string, replyText: string) => {
      const source = extractMermaid(replyText);
      if (source === null) return; // Conversational reply — apply nothing.

      const previousContent = getDiagramSource();
      applySuggestionInternal(source);
      setPendingSuggestion({ messageId: assistantId, previousContent });
    },
    [applySuggestionInternal, getDiagramSource]
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const { activeProvider, providers } = settingsRef.current.ai;
      const config = activeProvider ? providers[activeProvider] : undefined;
      if (!activeProvider || !isConfigured(config)) {
        setError('No AI provider is configured. Open AI settings to add one.');
        return;
      }

      setError(null);
      // A new send always supersedes whatever was pending — the previous
      // suggestion's applied text stays in the editor (implicit accept),
      // only its Apply/Cancel affordance disappears.
      setPendingSuggestion(null);

      const userMessage: AiMessage = { id: newId(), role: 'user', content: trimmed };
      const assistantId = newId();
      const assistantPlaceholder: AiMessage = { id: assistantId, role: 'assistant', content: '' };

      const history = [...messagesRef.current, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);

      const run = async () => {
        // Cancel any previous stream first — it clears `currentAssistantIdRef`
        // as part of finalizing, so this new message's id must be assigned
        // AFTER that cancellation, not before, or it would be wiped out.
        await cancelInFlight();
        currentAssistantIdRef.current = assistantId;

        const streamId = newId();
        currentStreamIdRef.current = streamId;
        setIsStreaming(true);

        let invoke: typeof import('@tauri-apps/api/core').invoke;
        try {
          ({ invoke } = await import('@tauri-apps/api/core'));
        } catch {
          // Not running inside Tauri (e.g. plain `pnpm dev`) — there is no
          // backend to reach, so degrade to a clear message instead of an
          // error spew from a failed dynamic import.
          setError('AI is unavailable outside the desktop app.');
          finalizeStream();
          return;
        }

        try {
          await invoke('send_ai_message', {
            config,
            messages: history,
            diagramSource: getDiagramSource(),
            streamId,
          });
        } catch (err) {
          if (currentStreamIdRef.current !== streamId) return; // Superseded before the call even returned.
          setError(err instanceof Error ? err.message : String(err));
          finalizeStream();
        }
      };

      void run();
    },
    [cancelInFlight, finalizeStream, getDiagramSource]
  );

  const acceptPending = useCallback(() => {
    // The suggestion is already applied — accepting just drops the
    // Apply/Cancel affordance and keeps the text as-is.
    setPendingSuggestion(null);
  }, []);

  const cancelPending = useCallback(() => {
    const current = pendingSuggestionRef.current;
    if (!current) return;
    applySuggestionInternal(current.previousContent);
    setPendingSuggestion(null);
  }, [applySuggestionInternal]);

  const reset = useCallback(() => {
    void cancelInFlight();
    setMessages([]);
    setPendingSuggestion(null);
    setError(null);
  }, [cancelInFlight]);

  // ── Event listener ──────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const handleChunk = (chunk: AiStreamChunk) => {
      if (cancelled) return;
      if (chunk.streamId !== currentStreamIdRef.current) return; // Stale — belongs to a cancelled/superseded stream.

      const assistantId = currentAssistantIdRef.current;
      if (!assistantId) return;

      switch (chunk.type) {
        case 'text-delta':
          streamTextRef.current += chunk.text;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk.text } : m))
          );
          break;

        case 'done': {
          const finalText = streamTextRef.current;
          finalizeStream();
          applyPendingFromReply(assistantId, finalText);
          break;
        }

        case 'error':
          setError(chunk.message);
          finalizeStream();
          // Drop an empty placeholder bubble — nothing streamed before the
          // failure, so there is nothing worth keeping in the transcript.
          setMessages((prev) => prev.filter((m) => !(m.id === assistantId && m.content === '')));
          break;
      }
    };

    const teardown = manageAsyncResource<() => void>(
      async () => {
        try {
          const { listen } = await import('@tauri-apps/api/event');
          return await listen<AiStreamChunk>('ai-stream', (event) => handleChunk(event.payload));
        } catch {
          // Not in Tauri environment (Vite-only dev) — there is no backend
          // to stream from, so there is nothing to listen for.
          return () => {
            // No listener was established — nothing to release.
          };
        }
      },
      (unlisten) => unlisten()
    );

    return () => {
      cancelled = true;
      teardown();
    };
  }, [applyPendingFromReply, finalizeStream]);

  // Cancel any in-flight stream on unmount so a straggling event never
  // fires into a component that no longer exists. `cancelInFlight` is a
  // stable reference (its own dependency chain bottoms out at `[]`), so
  // listing it here does not cause this effect to re-run on every render.
  useEffect(() => {
    return () => {
      void cancelInFlight();
    };
  }, [cancelInFlight]);

  return {
    messages,
    isStreaming,
    pendingSuggestion,
    error,
    send,
    stop,
    acceptPending,
    cancelPending,
    notifyUserEdit,
    reset,
  };
}
