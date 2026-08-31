import { Send, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

// ── Constants ───────────────────────────────────────────

const MAX_TEXTAREA_HEIGHT = 160;

/**
 * Height of the composer's single-line state, shared by the textarea and the
 * send button so the two line up exactly: 20px line box + 12px vertical
 * padding (`py-1.5`) + 2px borders. Declared once because the button has no
 * way to derive it from the textarea, and an approximate match reads as a
 * misalignment at this size.
 */
const COMPOSER_ROW_HEIGHT = 34;

// ── Props ───────────────────────────────────────────────

interface ChatComposerProps {
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

// ── Component ───────────────────────────────────────────

// Only rendered once a provider is configured — AIPanel hides the composer
// entirely otherwise, so there is no disabled state to model here.
export default function ChatComposer({ isStreaming, onSend, onStop }: ChatComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: reset to 'auto' first so shrinking (e.g. after clearing the
  // textarea on send) is picked up too, not just growth.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `text` isn't read directly, but the effect must re-run on every keystroke to recompute `scrollHeight` against the new content.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // `scrollHeight` covers content plus padding but NOT borders, while
    // Preflight puts every element in `border-box` — assigning it directly
    // leaves the field permanently 2px shy of its own content, which both
    // clips the descenders and stops it lining up with the button.
    // `offsetHeight - clientHeight` is exactly that border, measured rather
    // than hard-coded.
    const borders = el.offsetHeight - el.clientHeight;
    const content = Math.max(el.scrollHeight + borders, COMPOSER_ROW_HEIGHT);
    el.style.height = `${Math.min(content, MAX_TEXTAREA_HEIGHT)}px`;
  }, [text]);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }, [text, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (isStreaming) return; // Stop is a separate explicit action.
      submit();
    }
  };

  return (
    // Button beside the textarea rather than on its own row below it: the
    // panel is narrow and vertical space is the scarce resource here. Aligned
    // to the bottom so it stays level with the last line as the field grows.
    <div className="flex items-end gap-2 border-t border-neutral-200 p-2 dark:border-slate-700">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe a diagram… (⌘↵)"
        rows={1}
        className="max-h-40 min-w-0 flex-1 resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      {/* Icon-only, so the label moves to `title` and a screen-reader span. */}
      {isStreaming ? (
        <Button
          size="icon-sm"
          variant="destructive"
          title="Stop generating"
          style={{ height: COMPOSER_ROW_HEIGHT, width: COMPOSER_ROW_HEIGHT }}
          onClick={onStop}
        >
          <Square className="size-3.5" />
          <span className="sr-only">Stop generating</span>
        </Button>
      ) : (
        <Button
          size="icon-sm"
          title="Send (⌘/Ctrl+Enter)"
          style={{ height: COMPOSER_ROW_HEIGHT, width: COMPOSER_ROW_HEIGHT }}
          onClick={submit}
          disabled={!text.trim()}
        >
          <Send className="size-3.5" />
          <span className="sr-only">Send</span>
        </Button>
      )}
    </div>
  );
}
