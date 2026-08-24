import { ExternalLink, FileCode, Info, Settings as SettingsIcon, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { type ThemePreference, useSettings } from '../hooks/useSettings';

// ── Constants ────────────────────────────────────────────

const GITHUB_URL = 'https://github.com/skydiver/mermaidjs-desktop-client';

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const FONT_DEFAULT = 'system';

function useMonospaceFonts(): { value: string; label: string }[] {
  const [fonts, setFonts] = useState<{ value: string; label: string }[]>([
    { value: FONT_DEFAULT, label: 'Default (System)' },
  ]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const names: string[] = await invoke('list_monospace_fonts');
        if (cancelled) return;
        setFonts([
          { value: FONT_DEFAULT, label: 'Default (System)' },
          ...names.map((name) => ({ value: name, label: name })),
        ]);
      } catch {
        // Not in Tauri environment — keep default only
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return fonts;
}

const INDENT_TYPE_OPTIONS: { value: 'space' | 'tab'; label: string }[] = [
  { value: 'space', label: 'Space' },
  { value: 'tab', label: 'Tab' },
];

const INDENT_SIZE_OPTIONS = [
  { value: '2', label: '2' },
  { value: '4', label: '4' },
  { value: '8', label: '8' },
];

const SECTIONS = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'editor', label: 'Editor', icon: FileCode },
  { id: 'about', label: 'About', icon: Info },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

// ── Props ────────────────────────────────────────────────

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SectionId;
}

// ── Reusable Sub-Components ──────────────────────────────

function SubsectionHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-slate-400">
      {title}
    </h3>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm font-medium text-neutral-700 dark:text-slate-200">{label}</span>
      </div>
      {children}
    </div>
  );
}

// ── Section Content ──────────────────────────────────────

function GeneralSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <div>
        <SubsectionHeader title="Appearance" />
        <div className="divide-y divide-neutral-200 rounded-lg bg-white px-4 dark:divide-slate-700/50 dark:bg-slate-800/50">
          <SettingRow label="App Theme">
            <SegmentedControl
              options={THEME_OPTIONS}
              value={settings.theme}
              onChange={(v) => updateSettings({ theme: v })}
            />
          </SettingRow>
          <SettingRow label="Diagram Theme">
            <SegmentedControl
              options={THEME_OPTIONS}
              value={settings.diagramTheme}
              onChange={(v) => updateSettings({ diagramTheme: v })}
            />
          </SettingRow>
          <SettingRow label="Dot Grid Background">
            <Switch
              checked={settings.showDotGrid}
              onCheckedChange={(v) => updateSettings({ showDotGrid: v })}
            />
          </SettingRow>
        </div>
      </div>

      <div>
        <SubsectionHeader title="Behavior" />
        <div className="divide-y divide-neutral-200 rounded-lg bg-white px-4 dark:divide-slate-700/50 dark:bg-slate-800/50">
          <SettingRow label="Auto-save Documents">
            <Switch
              checked={settings.autoSave}
              onCheckedChange={(v) => updateSettings({ autoSave: v })}
            />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

function EditorSection() {
  const { settings, updateSettings } = useSettings();
  const fontOptions = useMonospaceFonts();

  return (
    <div className="space-y-6">
      {/* Font */}
      <div>
        <SubsectionHeader title="Font" />
        <div className="divide-y divide-neutral-200 rounded-lg bg-white px-4 dark:divide-slate-700/50 dark:bg-slate-800/50">
          <SettingRow label="Font">
            <Select
              value={settings.editorFontFamily || FONT_DEFAULT}
              onValueChange={(v) =>
                updateSettings({ editorFontFamily: v === FONT_DEFAULT ? '' : v })
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Size">
            <div className="flex items-center gap-3">
              <Slider
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={1}
                value={[settings.editorFontSize]}
                onValueChange={([v]) => updateSettings({ editorFontSize: v })}
                className="w-28"
              />
              <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                {settings.editorFontSize}px
              </span>
            </div>
          </SettingRow>
        </div>
      </div>

      {/* Display */}
      <div>
        <SubsectionHeader title="Display" />
        <div className="divide-y divide-neutral-200 rounded-lg bg-white px-4 dark:divide-slate-700/50 dark:bg-slate-800/50">
          <SettingRow label="Syntax Highlighting">
            <Switch
              checked={settings.syntaxHighlighting}
              onCheckedChange={(v) => updateSettings({ syntaxHighlighting: v })}
            />
          </SettingRow>
          <SettingRow label="Word Wrap">
            <Switch
              checked={settings.wordWrap}
              onCheckedChange={(v) => updateSettings({ wordWrap: v })}
            />
          </SettingRow>
          <SettingRow label="Show Invisibles">
            <Switch
              checked={settings.showInvisibles}
              onCheckedChange={(v) => updateSettings({ showInvisibles: v })}
            />
          </SettingRow>
          <SettingRow label="Disable Ligatures">
            <Switch
              checked={settings.disableLigatures}
              onCheckedChange={(v) => updateSettings({ disableLigatures: v })}
            />
          </SettingRow>
        </div>
      </div>

      {/* Formatting */}
      <div>
        <SubsectionHeader title="Formatting" />
        <div className="divide-y divide-neutral-200 rounded-lg bg-white px-4 dark:divide-slate-700/50 dark:bg-slate-800/50">
          <SettingRow label="Indent Type">
            <SegmentedControl<'space' | 'tab'>
              options={INDENT_TYPE_OPTIONS}
              value={settings.indentType}
              onChange={(v) => updateSettings({ indentType: v })}
              className="w-36"
            />
          </SettingRow>
          <SettingRow label="Indent Size">
            <SegmentedControl
              options={INDENT_SIZE_OPTIONS}
              value={String(settings.indentSize)}
              onChange={(v) => updateSettings({ indentSize: Number(v) })}
              className="w-36"
            />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

function AboutSection() {
  const handleOpenGitHub = async () => {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(GITHUB_URL);
    } catch {
      window.open(GITHUB_URL, '_blank');
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <img src="/app-icon.png" alt="Mermaid Desktop" className="size-16" />
      <h3 className="text-lg font-semibold">Mermaid Desktop</h3>
      <p className="text-sm text-neutral-500 dark:text-slate-400">Version {__APP_VERSION__}</p>
      <p className="text-sm text-neutral-600 dark:text-slate-300">
        A desktop app for Mermaid diagrams
      </p>
      <p className="text-xs text-neutral-400 dark:text-slate-500">
        &copy; {new Date().getFullYear()}
      </p>
      <button
        type="button"
        onClick={handleOpenGitHub}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        <ExternalLink size={14} />
        View on GitHub
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────

export default function SettingsDialog({
  open,
  onOpenChange,
  initialSection,
}: SettingsDialogProps) {
  const { resetSettings } = useSettings();
  const [section, setSection] = useState<SectionId>(initialSection ?? 'general');
  const [confirmReset, setConfirmReset] = useState(false);

  // Reset to initialSection when dialog opens
  useEffect(() => {
    if (open) {
      setSection(initialSection ?? 'general');
      setConfirmReset(false);
    }
  }, [open, initialSection]);

  // Auto-dismiss confirmation after 3 seconds
  useEffect(() => {
    if (!confirmReset) return;
    const timer = setTimeout(() => setConfirmReset(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      {open && <div className="fixed inset-x-0 bottom-0 top-10 z-50 bg-black/70" />}
      <DialogContent
        className="sm:max-w-4xl p-0 shadow-2xl"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <div className="flex h-[600px] overflow-hidden rounded-lg">
          {/* Sidebar */}
          <aside className="flex w-44 flex-col border-r border-neutral-200 dark:border-slate-700 dark:bg-slate-900">
            <nav className="flex-1 space-y-1 p-2">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    section === id
                      ? 'bg-neutral-200 text-neutral-900 dark:bg-slate-700 dark:text-slate-100'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>
            <div className="border-t border-neutral-200 p-2 dark:border-slate-700">
              {confirmReset ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetSettings();
                      setConfirmReset(false);
                    }}
                    className="flex-1 rounded-md px-3 py-1.5 text-xs text-red-700 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 rounded-md px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-700/50"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="w-full rounded-md px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
                >
                  Reset to defaults
                </button>
              )}
            </div>
          </aside>

          {/* Main content */}
          <main className="flex flex-1 flex-col bg-neutral-100 dark:bg-slate-900/50">
            <header className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-slate-700">
              <h2 className="font-semibold">{SECTIONS.find((s) => s.id === section)?.label}</h2>
              <DialogClose asChild>
                <button
                  type="button"
                  className="rounded-md p-1 opacity-70 transition-all hover:bg-neutral-200 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus:outline-hidden dark:hover:bg-slate-700"
                >
                  <X size={16} />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </header>
            <div className="flex flex-1 flex-col overflow-y-auto p-4">
              {section === 'general' && <GeneralSection />}
              {section === 'editor' && <EditorSection />}
              {section === 'about' && <AboutSection />}
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
