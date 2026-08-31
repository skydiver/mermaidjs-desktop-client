import { AlertTriangle, Check, Copy, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { extractMermaid } from '@/lib/ai/extract-mermaid';
import type { AiMessage } from '@/lib/ai/types';

// ── Props ───────────────────────────────────────────────

interface ChatMessageProps {
  message: AiMessage;
  /** Whether this is the single newest assistant message with a suggestion awaiting Apply/Cancel. */
  isPending?: boolean;
  onAccept?: () => void;
  onCancel?: () => void;
}

// ── Component ───────────────────────────────────────────

export default function ChatMessage({
  message,
  isPending = false,
  onAccept,
  onCancel,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const mermaidBlock = isUser ? null : extractMermaid(message.content);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-neutral-100 text-neutral-800 dark:bg-slate-800 dark:text-slate-100'
        }`}
      >
        {/* An assistant bubble with no content yet is a request in flight —
            the placeholder is pushed on send and filled by the first chunk, and
            it is dropped outright if the request fails, so an empty one always
            means "waiting". Before this, the wait rendered as a bare empty pill
            with no sign the app was doing anything. */}
        {!isUser && message.content.length === 0 ? (
          <ThinkingDots />
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}

        {mermaidBlock && <MermaidCodeBlock source={mermaidBlock} />}

        {isPending && (
          <div className="mt-2 flex gap-2">
            {/* Apply is the affirmative action, so it carries the primary
                variant — the borderless `secondary` read as unstyled next to
                the bordered controls around it. */}
            <Button size="xs" onClick={onAccept}>
              <Check className="size-3" />
              Apply
            </Button>
            <Button size="xs" variant="outline" onClick={onCancel}>
              <X className="size-3" />
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[85%] flex-col gap-2 rounded-lg border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <p className="whitespace-pre-wrap break-words">{message}</p>
        </div>
        <Button size="xs" variant="outline" className="self-start" onClick={onRetry}>
          <RotateCcw className="size-3" />
          Retry
        </Button>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

/**
 * Three pulsing dots shown while the assistant's first chunk is still on its
 * way. `motion-safe:` keeps it static for users who ask the OS to reduce
 * motion, and the status role announces the wait rather than leaving a screen
 * reader on a silent empty bubble.
 */
function ThinkingDots() {
  return (
    <span className="flex items-center gap-1 py-1" role="status" aria-label="Waiting for a reply">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 rounded-full bg-current opacity-40 motion-safe:animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function MermaidCodeBlock({ source }: { source: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied/unavailable — nothing more we can do here;
      // the Copy button simply stays in its un-copied state.
    }
  };

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-neutral-200 px-2 py-1 dark:border-slate-700">
        <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-slate-500">
          mermaid
        </span>
        <Button size="xs" variant="ghost" onClick={handleCopy}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto p-2 font-mono text-xs text-neutral-700 dark:text-slate-300">
        {source}
      </pre>
    </div>
  );
}
