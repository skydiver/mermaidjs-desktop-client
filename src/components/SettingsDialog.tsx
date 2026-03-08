import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type ThemePreference, useSettings } from '../hooks/useSettings';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Theme selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Theme</label>
            <div className="flex gap-1">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateSettings({ theme: opt.value })}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    settings.theme === opt.value
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Editor font size */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="editor-font-size">
              Editor Font Size
            </label>
            <div className="flex items-center gap-3">
              <input
                id="editor-font-size"
                type="range"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={1}
                value={settings.editorFontSize}
                onChange={(e) => updateSettings({ editorFontSize: Number(e.target.value) })}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-900 dark:bg-neutral-700 dark:accent-neutral-100"
              />
              <span className="w-8 text-center text-sm tabular-nums text-neutral-500 dark:text-neutral-400">
                {settings.editorFontSize}
              </span>
            </div>
          </div>

          {/* Syntax highlighting */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="syntax-highlighting">
              Syntax Highlighting
            </label>
            <button
              id="syntax-highlighting"
              type="button"
              role="switch"
              aria-checked={settings.syntaxHighlighting}
              onClick={() => updateSettings({ syntaxHighlighting: !settings.syntaxHighlighting })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                settings.syntaxHighlighting
                  ? 'bg-neutral-900 dark:bg-neutral-100'
                  : 'bg-neutral-300 dark:bg-neutral-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform dark:bg-neutral-900 ${
                  settings.syntaxHighlighting ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
