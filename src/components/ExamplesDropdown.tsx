import { BookOpen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ── Load examples at module level ───────────────────────

interface ExampleItem {
  label: string;
  content: string;
  order: number;
}

const EXAMPLES = loadExamples();

function loadExamples(): ExampleItem[] {
  const modules = import.meta.glob('../examples/*.mmd', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  return Object.entries(modules)
    .map(([path, content]) => {
      const match = path.match(/\/([^/]+)\.mmd$/);
      const id = match?.[1];
      if (!id) return null;
      const { order, name } = parseExampleId(id);
      return { label: formatLabel(name), content, order };
    })
    .filter((item): item is ExampleItem => item !== null)
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.label.localeCompare(b.label)));
}

function parseExampleId(rawId: string): { name: string; order: number } {
  const [, orderPart, namePart] = rawId.match(/^(\d+)[-_](.+)$/) ?? [];
  if (orderPart && namePart) {
    return { name: namePart, order: Number.parseInt(orderPart, 10) };
  }
  return { name: rawId, order: Number.MAX_SAFE_INTEGER };
}

function formatLabel(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

// ── Props ───────────────────────────────────────────────

interface ExamplesDropdownProps {
  onSelect: (content: string) => void;
}

// ── Component ───────────────────────────────────────────

export default function ExamplesDropdown({ onSelect }: ExamplesDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (EXAMPLES.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Examples"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-7 items-center justify-center gap-1 rounded px-1.5 text-xs font-medium transition-colors ${
          open
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
            : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200'
        }`}
      >
        <BookOpen size={14} />
        <span>Examples</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          {EXAMPLES.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false);
                onSelect(item.content);
              }}
              className="flex w-full items-center px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
