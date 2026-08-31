import { Settings, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ChatComposer from '@/components/ai/ChatComposer';
import ChatMessage, { ChatErrorMessage } from '@/components/ai/ChatMessage';
import ProviderPicker from '@/components/ai/ProviderPicker';
import { Button } from '@/components/ui/button';
import type { PendingSuggestion } from '@/hooks/useAIChat';
import { useSettings } from '@/hooks/useSettings';
import type { AiMessage } from '@/lib/ai/types';

// ── Props ───────────────────────────────────────────────

/**
 * Pure props/handles — the panel owns none of its layout, sizing, or
 * open/close animation (the orchestrator's pane does), and it does not call
 * `useAIChat` itself, so it can be driven by any conversation state.
 */
interface AIPanelProps {
  messages: AiMessage[];
  isStreaming: boolean;
  pendingSuggestion: PendingSuggestion | null;
  error: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
  onAcceptPending: () => void;
  onCancelPending: () => void;
  onClose: () => void;
  /** Opens the Settings dialog to the AI section — used by the empty state's call to action. */
  onOpenAiSettings: () => void;
}

// ── Component ───────────────────────────────────────────

export default function AIPanel({
  messages,
  isStreaming,
  pendingSuggestion,
  error,
  onSend,
  onStop,
  onAcceptPending,
  onCancelPending,
  onClose,
  onOpenAiSettings,
}: AIPanelProps) {
  const { settings } = useSettings();
  const bottomRef = useRef<HTMLDivElement>(null);

  // A provider is only ever assigned to `activeProvider` via ProviderPicker,
  // which lists exclusively configured providers — so its presence is a
  // reliable-enough proxy for "the panel is usable" without re-deriving the
  // full keychain-aware configured check here too.
  const hasActiveProvider = settings.ai.activeProvider !== null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `messages.length`/`isStreaming` intentionally re-trigger the scroll — the effect body only reads the ref, but it must re-run on every new message and on stream start/stop.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, isStreaming]);

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const handleRetry = () => {
    if (lastUserMessage) onSend(lastUserMessage.content);
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-slate-700">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-4 text-neutral-500 dark:text-slate-400" />
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-slate-100">
            AI Assistant
          </h2>
        </div>
        <Button size="icon-xs" variant="ghost" onClick={onClose}>
          <X className="size-4" />
          <span className="sr-only">Close AI panel</span>
        </Button>
      </div>

      {/* Provider picker */}
      {hasActiveProvider && (
        <div className="border-b border-neutral-200 p-2 dark:border-slate-700">
          <ProviderPicker />
        </div>
      )}

      {/* Message list / empty state */}
      {!hasActiveProvider ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-neutral-500 dark:text-slate-400">
            No AI provider is configured yet.
          </p>
          {/* Outline rather than primary, matching the Test button in the AI
              settings section — the filled variant reads as a light slab
              against the panel's dark background. */}
          <Button size="sm" variant="outline" onClick={onOpenAiSettings}>
            <Settings className="size-3.5" />
            Open AI Settings
          </Button>
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.length === 0 && (
            <p className="text-center text-xs text-neutral-400 dark:text-slate-500">
              Ask for a diagram, or paste one to iterate on.
            </p>
          )}
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isPending={pendingSuggestion?.messageId === message.id}
              onAccept={onAcceptPending}
              onCancel={onCancelPending}
            />
          ))}
          {error && <ChatErrorMessage message={error} onRetry={handleRetry} />}
          <div ref={bottomRef} />
        </div>
      )}

      {/* No composer until a provider is configured: a permanently disabled
          textarea invites typing into a dead control, while the empty state
          above already carries the one useful action (open AI settings). */}
      {hasActiveProvider && (
        <ChatComposer isStreaming={isStreaming} onSend={onSend} onStop={onStop} />
      )}
    </div>
  );
}
