import { FilePlus, FolderOpen, HelpCircle, Moon, Save, Settings, Sun } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSettings } from '../hooks/useSettings';

interface ToolbarProps {
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onOpenExamples: () => void;
  onOpenExport: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  isDirty: boolean;
  hasContent: boolean;
}

export default function Toolbar({
  onNewFile,
  onOpenFile,
  onSaveFile,
  onOpenExamples,
  onOpenExport,
  onOpenHelp,
  onOpenSettings,
  isDirty,
  hasContent,
}: ToolbarProps) {
  const { settings, isDark, updateSettings } = useSettings();

  // Vanilla JS drag handler — React synthetic events don't work reliably
  // with Tauri's startDragging() which needs the native mousedown event context.
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;

    type AppWindow = Awaited<
      ReturnType<typeof import('@tauri-apps/api/window')['getCurrentWindow']>
    >;
    let appWindow: AppWindow | null = null;
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => {
        appWindow = getCurrentWindow();
      })
      .catch(() => {
        /* Tauri unavailable in browser dev */
      });

    const handleMouseDown = (e: MouseEvent) => {
      if (!appWindow) return;
      if ((e.target as HTMLElement).closest('button')) return;
      if (e.buttons === 1) {
        if (e.detail === 2) {
          appWindow.toggleMaximize();
        } else {
          appWindow.startDragging();
        }
      }
    };

    el.addEventListener('mousedown', handleMouseDown);
    return () => el.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const toggleTheme = () => {
    const next =
      settings.theme === 'system' ? 'dark' : settings.theme === 'dark' ? 'light' : 'system';
    updateSettings({ theme: next });
  };

  return (
    <div
      ref={toolbarRef}
      data-tauri-drag-region
      className="flex h-10 shrink-0 items-center gap-1 border-b border-neutral-200 bg-neutral-50 pr-2 pl-[90px] dark:border-neutral-700 dark:bg-neutral-800"
    >
      {/* File actions */}
      <ToolbarButton title="New File" onClick={onNewFile}>
        <FilePlus size={16} />
      </ToolbarButton>
      <ToolbarButton title="Open File" onClick={onOpenFile}>
        <FolderOpen size={16} />
      </ToolbarButton>
      <ToolbarButton title="Save" disabled={!isDirty} onClick={onSaveFile}>
        <Save size={16} />
      </ToolbarButton>

      <Separator />

      {/* Examples & Export placeholders */}
      <ToolbarButton title="Examples" onClick={onOpenExamples}>
        <span className="text-xs font-medium">Examples</span>
      </ToolbarButton>
      <ToolbarButton title="Export" disabled={!hasContent} onClick={onOpenExport}>
        <span className="text-xs font-medium">Export</span>
      </ToolbarButton>

      <div className="flex-1" data-tauri-drag-region />

      {/* Theme toggle */}
      <ToolbarButton title={`Theme: ${settings.theme}`} onClick={toggleTheme}>
        {isDark ? <Moon size={16} /> : <Sun size={16} />}
      </ToolbarButton>

      {/* Help & Settings */}
      <ToolbarButton title="Help" onClick={onOpenHelp}>
        <HelpCircle size={16} />
      </ToolbarButton>
      <ToolbarButton title="Settings" onClick={onOpenSettings}>
        <Settings size={16} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 items-center justify-center rounded px-1.5 transition-colors ${
        disabled
          ? 'cursor-default text-neutral-300 dark:text-neutral-600'
          : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />;
}
