import { SegmentedControl } from '@/components/ui/segmented-control';
import { Switch } from '@/components/ui/switch';
import { type ThemePreference, useSettings } from '@/hooks/useSettings';
import { SettingRow, SubsectionHeader } from './shared';

// ── Constants ────────────────────────────────────────────

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

// ── Component ─────────────────────────────────────────────

export default function GeneralSection() {
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
