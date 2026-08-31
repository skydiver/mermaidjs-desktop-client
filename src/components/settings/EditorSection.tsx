import { useEffect, useState } from 'react';
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
import { useSettings } from '@/hooks/useSettings';
import { SettingRow, SubsectionHeader } from './shared';

// ── Constants ────────────────────────────────────────────

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;
const FONT_DEFAULT = 'system';

const INDENT_TYPE_OPTIONS: { value: 'space' | 'tab'; label: string }[] = [
  { value: 'space', label: 'Space' },
  { value: 'tab', label: 'Tab' },
];

const INDENT_SIZE_OPTIONS = [
  { value: '2', label: '2' },
  { value: '4', label: '4' },
  { value: '8', label: '8' },
];

// ── Helpers ─────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────

export default function EditorSection() {
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
