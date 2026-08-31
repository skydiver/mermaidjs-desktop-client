import { Send, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

// ── Constants ───────────────────────────────────────────

const MAX_TEXTAREA_HEIGHT = 160;

// ── Props ───────────────────────────────────────────────

interface ChatComposerProps {
  isStreaming: boolean;
  /** When set, the composer is disabled and this reason is shown as a placeholder/hint (e.g. no provider configured). */
  disabledReason?: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
}

// ── Component ───────────────────────────────────────────

export default function ChatComposer({
  isStreaming,
  disabledReason,
  onSend,
  onStop,
}: ChatComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disabled = !!disabledReason;

  // Auto-grow: reset to 'auto' first so shrinking (e.g. after clearing the
  // textarea on send) is picked up too, not just growth.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `text` isn't read directly, but the effect must re-run on every keystroke to recompute `scrollHeight` against the new content.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [text]);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (isStreaming) return; // Stop is a separate explicit action.
      submit();
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-200 p-2 dark:border-slate-700">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={
          disabledReason ?? 'Ask the assistant to draw or change a diagram… (⌘/Ctrl+Enter to send)'
        }
        rows={1}
        className="max-h-40 w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      <div className="flex justify-end">
        {isStreaming ? (
          <Button size="sm" variant="destructive" onClick={onStop}>
            <Square className="size-3.5" />
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={submit} disabled={disabled || !text.trim()}>
            <Send className="size-3.5" />
            Send
          </Button>
        )}
      </div>
    </div>
  );
}
