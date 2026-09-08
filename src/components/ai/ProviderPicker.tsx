import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfiguredProviders } from '@/hooks/useConfiguredProviders';
import { useSettings } from '@/hooks/useSettings';
import type { AiProviderId } from '@/lib/ai/types';

// ── Component ───────────────────────────────────────────

/**
 * Dropdown listing only CONFIGURED providers (model set, plus a keychain key
 * or — for Ollama — a base URL). Selecting one writes `settings.ai.activeProvider`.
 * Reads `list_ai_providers` once on mount to learn which providers already
 * have a keychain key; outside Tauri (or before that resolves) every
 * provider is treated as keyless, so only a fully key-less Ollama setup can
 * show up in plain `pnpm dev`.
 */
export default function ProviderPicker() {
  const { settings, updateSettings } = useSettings();
  const { configured } = useConfiguredProviders();

  if (configured.length === 0) return null;

  return (
    <Select
      value={settings.ai.activeProvider ?? undefined}
      onValueChange={(value) =>
        updateSettings({ ai: { ...settings.ai, activeProvider: value as AiProviderId } })
      }
    >
      <SelectTrigger size="sm" className="w-full">
        <SelectValue placeholder="Choose a provider…" />
      </SelectTrigger>
      <SelectContent>
        {configured.map((meta) => (
          <SelectItem key={meta.id} value={meta.id}>
            {meta.label} · {settings.ai.providers[meta.id].model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
