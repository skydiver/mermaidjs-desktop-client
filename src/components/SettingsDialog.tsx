import { ExternalLink, FileCode, Info, Settings as SettingsIcon, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
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

const FONT_OPTIONS = [
  { value: '', label: 'Default (System)' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'SF Mono', label: 'SF Mono' },
  { value: 'Cascadia Code', label: 'Cascadia Code' },
  { value: 'Source Code Pro', label: 'Source Code Pro' },
  { value: 'Menlo', label: 'Menlo' },
  { value: 'Monaco', label: 'Monaco' },
  { value: 'Courier New', label: 'Courier New' },
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
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
      {title}
    </h3>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{label}</span>
        {description && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
        checked ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-neutral-300 dark:bg-neutral-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform dark:bg-neutral-900 ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ── Section Content ──────────────────────────────────────

function GeneralSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <div>
        <SubsectionHeader title="Appearance" />
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
      </div>

      <div>
        <SubsectionHeader title="Behavior" />
        <SettingRow label="Auto-save documents">
          <ToggleSwitch
            checked={settings.autoSave}
            onChange={(v) => updateSettings({ autoSave: v })}
          />
        </SettingRow>
      </div>
    </div>
  );
}

function EditorSection() {
  const { settings, updateSettings } = useSettings();

  const stepperBtnClass =
    'flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800';

  const selectClass =
    'rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-600';

  return (
    <div className="space-y-6">
      {/* Font */}
      <div>
        <SubsectionHeader title="Font" />
        <SettingRow label="Font">
          <select
            value={settings.editorFontFamily}
            onChange={(e) => updateSettings({ editorFontFamily: e.target.value })}
            className={selectClass}
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Size">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  editorFontSize: Math.max(FONT_SIZE_MIN, settings.editorFontSize - 1),
                })
              }
              className={stepperBtnClass}
            >
              −
            </button>
            <span className="w-8 text-center text-sm tabular-nums">{settings.editorFontSize}</span>
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  editorFontSize: Math.min(FONT_SIZE_MAX, settings.editorFontSize + 1),
                })
              }
              className={stepperBtnClass}
            >
              +
            </button>
          </div>
        </SettingRow>
      </div>

      {/* Display */}
      <div>
        <SubsectionHeader title="Display" />
        <SettingRow label="Syntax Highlighting">
          <ToggleSwitch
            checked={settings.syntaxHighlighting}
            onChange={(v) => updateSettings({ syntaxHighlighting: v })}
          />
        </SettingRow>
        <SettingRow label="Word Wrap">
          <ToggleSwitch
            checked={settings.wordWrap}
            onChange={(v) => updateSettings({ wordWrap: v })}
          />
        </SettingRow>
        <SettingRow label="Show Invisibles">
          <ToggleSwitch
            checked={settings.showInvisibles}
            onChange={(v) => updateSettings({ showInvisibles: v })}
          />
        </SettingRow>
        <SettingRow label="Disable Ligatures">
          <ToggleSwitch
            checked={settings.disableLigatures}
            onChange={(v) => updateSettings({ disableLigatures: v })}
          />
        </SettingRow>
      </div>

      {/* Formatting */}
      <div>
        <SubsectionHeader title="Formatting" />
        <SettingRow label="Indent Type">
          <select
            value={settings.indentType}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'space' || value === 'tab') {
                updateSettings({ indentType: value });
              }
            }}
            className={selectClass}
          >
            <option value="space">Space</option>
            <option value="tab">Tab</option>
          </select>
        </SettingRow>
        <SettingRow label="Indent Size">
          <select
            value={settings.indentSize}
            onChange={(e) => updateSettings({ indentSize: Number(e.target.value) })}
            className={selectClass}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
        </SettingRow>
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
      <h3 className="text-lg font-semibold">Mermaid Desktop</h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Version {__APP_VERSION__}</p>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        A desktop app for Mermaid diagrams
      </p>
      <p className="text-xs text-neutral-400 dark:text-neutral-500">
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

  // Reset to initialSection when dialog opens
  useEffect(() => {
    if (open) {
      setSection(initialSection ?? 'general');
    }
  }, [open, initialSection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-10 z-50 bg-black/70" />
      )}
      <DialogContent
          className="sm:max-w-4xl p-0 shadow-2xl"
          showCloseButton={false}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <div className="flex h-[520px]">
          {/* Sidebar */}
          <aside className="flex w-44 flex-col border-r border-neutral-200 dark:border-neutral-700">
            <nav className="flex-1 space-y-1 p-2">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    section === id
                      ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>
            <div className="border-t border-neutral-200 p-2 dark:border-neutral-700">
              <button
                type="button"
                onClick={resetSettings}
                className="w-full rounded-md px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                Reset to defaults
              </button>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-700">
              <h2 className="font-semibold">{SECTIONS.find((s) => s.id === section)?.label}</h2>
              <DialogClose asChild>
                <button
                  type="button"
                  className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden"
                >
                  <X size={16} />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </header>
            <div className="flex-1 overflow-y-auto p-4">
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
