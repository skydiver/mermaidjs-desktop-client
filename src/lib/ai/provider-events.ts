// ── Provider change notifications ────────────────────────
//
// API keys live in the OS keychain, not in `settings.json`, so saving or
// removing one changes whether a provider counts as configured WITHOUT
// changing any React state. Nothing would tell an open AI panel to re-read
// `list_ai_providers`, and it would keep showing its "not configured" empty
// state until remounted. This is the smallest thing that closes that gap: the
// settings UI announces a key change, and anyone deriving state from the
// keychain re-reads it.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribes to keychain-backed provider changes. Returns an unsubscribe function. */
export function subscribeToProviderChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Announces that a provider's stored API key was added or removed. */
export function notifyProvidersChanged(): void {
  for (const listener of listeners) listener();
}
