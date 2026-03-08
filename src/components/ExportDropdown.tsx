import { Download, FileImage, FileType } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ExportFormat } from '../lib/export/export-diagram';

// ── Props ───────────────────────────────────────────────

interface ExportDropdownProps {
  disabled: boolean;
  onExport: (format: ExportFormat) => void;
}

// ── Component ───────────────────────────────────────────

export default function ExportDropdown({ disabled, onExport }: ExportDropdownProps) {
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

  function handleSelect(format: ExportFormat) {
    setOpen(false);
    onExport(format);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Export Diagram"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-7 items-center justify-center gap-1 rounded px-1.5 text-xs font-medium transition-colors ${
          disabled
            ? 'cursor-default text-neutral-300 dark:text-neutral-600'
            : open
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
              : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200'
        }`}
      >
        <Download size={14} />
        <span>Export</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-40 rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          <DropdownItem
            icon={<FileType size={14} />}
            label="Export as SVG"
            onClick={() => handleSelect('svg')}
          />
          <DropdownItem
            icon={<FileImage size={14} />}
            label="Export as PNG"
            onClick={() => handleSelect('png')}
          />
          <DropdownItem
            icon={<FileImage size={14} />}
            label="Export as PNG @2x"
            onClick={() => handleSelect('pngx2')}
          />
        </div>
      )}
    </div>
  );
}

// ── Dropdown item ───────────────────────────────────────

function DropdownItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
