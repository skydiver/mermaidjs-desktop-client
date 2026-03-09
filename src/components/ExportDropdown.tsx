import { Download, FileImage, FileType } from 'lucide-react';
import type { ExportFormat } from '../lib/export/export-diagram';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

// ── Props ───────────────────────────────────────────────

interface ExportDropdownProps {
  disabled: boolean;
  onExport: (format: ExportFormat) => void;
}

// ── Component ───────────────────────────────────────────

export default function ExportDropdown({ disabled, onExport }: ExportDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          title="Export Diagram"
          disabled={disabled}
          className={`flex h-7 items-center justify-center rounded px-1.5 transition-colors ${
            disabled
              ? 'cursor-default text-neutral-300 dark:text-slate-600'
              : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Download size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onExport('svg')}>
          <FileType size={14} />
          Export as SVG
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport('png')}>
          <FileImage size={14} />
          Export as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport('pngx2')}>
          <FileImage size={14} />
          Export as PNG @2x
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
