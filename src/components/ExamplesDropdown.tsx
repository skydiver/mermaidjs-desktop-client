import { BookOpen } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
  if (EXAMPLES.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Examples"
          className="flex h-7 items-center justify-center rounded px-1.5 transition-colors text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <BookOpen size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {EXAMPLES.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={() => onSelect(item.content)}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
