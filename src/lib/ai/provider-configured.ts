import type { AiProviderConfig, AiProviderId } from './types';

/**
 * A provider is usable once it has a model name AND a way to authenticate:
 * either an API key already saved in the OS keychain, or — for Ollama,
 * which runs unauthenticated on localhost — a base URL. This is the single
 * definition of "configured" shared by `ProviderPicker` (which lists only
 * configured providers) and `AiSection` (which shows the "Configured"
 * badge), so the two views can never disagree about what counts.
 */
export function isProviderConfigured(
  id: AiProviderId,
  config: AiProviderConfig | undefined,
  hasApiKey: boolean
): boolean {
  if (!config || config.model.trim().length === 0) return false;
  if (hasApiKey) return true;
  return id === 'ollama' && !!config.baseUrl?.trim();
}
