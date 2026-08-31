import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '@/hooks/useSettings';
import { isProviderConfigured } from '@/lib/ai/provider-configured';
import { AI_PROVIDERS, type AiProviderId, type AiProviderListing } from '@/lib/ai/types';

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
  const [listings, setListings] = useState<AiProviderListing[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<AiProviderListing[]>('list_ai_providers');
        if (!cancelled) setListings(result);
      } catch {
        // Not in Tauri, or the command failed — fall back to "no keys
        // known", which still lets a key-less Ollama setup be selected.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasApiKey = (id: AiProviderId) =>
    listings.find((l) => l.provider === id)?.hasApiKey ?? false;

  const configured = AI_PROVIDERS.filter((meta) =>
    isProviderConfigured(meta.id, settings.ai.providers[meta.id], hasApiKey(meta.id))
  );

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
