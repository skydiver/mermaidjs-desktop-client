import { useCallback, useEffect, useMemo, useState } from 'react';
import { isProviderConfigured } from '../lib/ai/provider-configured';
import { subscribeToProviderChanges } from '../lib/ai/provider-events';
import {
  AI_PROVIDERS,
  type AiProviderId,
  type AiProviderListing,
  type AiProviderMeta,
} from '../lib/ai/types';
import { useSettings } from './useSettings';

// ── Hook ────────────────────────────────────────────────

export interface UseConfiguredProvidersReturn {
  /** Providers usable right now, in `AI_PROVIDERS` order. */
  configured: AiProviderMeta[];
  /** Whether the keychain lookup has completed at least once. */
  loaded: boolean;
}

/**
 * The single source of truth for "which providers can we actually talk to".
 *
 * Whether a provider is usable depends on two stores that don't share a
 * change signal: `settings.ai.providers` (model, base URL) and the OS keychain
 * (API keys, reachable only through `list_ai_providers`). Deriving this in one
 * place keeps `AIPanel` and `ProviderPicker` from disagreeing.
 *
 * It also reconciles `settings.ai.activeProvider`, which nothing else does.
 * That matters more than it sounds: the panel used to gate itself on
 * `activeProvider`, while the only control that could set it — the picker —
 * rendered only once it was already set. Configuring a provider therefore left
 * the panel stuck on its empty state forever. Selecting the first configured
 * provider here breaks that cycle, and dropping an active provider that has
 * stopped being configured (its key was removed) prevents the mirror-image
 * problem of sending to a provider that can no longer authenticate.
 */
export function useConfiguredProviders(): UseConfiguredProvidersReturn {
  const { settings, updateSettings } = useSettings();
  const [listings, setListings] = useState<AiProviderListing[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<AiProviderListing[]>('list_ai_providers');
      setListings(result);
    } catch {
      // Not in Tauri (plain `pnpm dev`), or the command failed. Treated as
      // "no keys known", which still lets a key-less Ollama setup be used.
      setListings([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Re-read on mount and whenever a key is saved or removed. Model and base
  // URL edits need no re-read — they live in `settings`, which `configured`
  // already derives from directly.
  useEffect(() => {
    void refresh();
    return subscribeToProviderChanges(() => {
      void refresh();
    });
  }, [refresh]);

  const configured = useMemo(() => {
    const hasApiKey = (id: AiProviderId) =>
      listings.find((listing) => listing.provider === id)?.hasApiKey ?? false;
    return AI_PROVIDERS.filter((meta) =>
      isProviderConfigured(meta.id, settings.ai.providers[meta.id], hasApiKey(meta.id))
    );
  }, [listings, settings.ai.providers]);

  const { activeProvider } = settings.ai;
  useEffect(() => {
    // Wait for the keychain read: acting on an empty listing would clear a
    // perfectly valid `activeProvider` on every mount.
    if (!loaded) return;

    const activeIsUsable =
      activeProvider !== null && configured.some((meta) => meta.id === activeProvider);
    if (activeIsUsable) return;

    const next = configured[0]?.id ?? null;
    if (next === activeProvider) return;

    updateSettings({ ai: { ...settings.ai, activeProvider: next } });
  }, [loaded, configured, activeProvider, settings.ai, updateSettings]);

  return { configured, loaded };
}
