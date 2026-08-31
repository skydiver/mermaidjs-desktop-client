import { CheckCircle2, ChevronDown, ChevronRight, Loader2, TriangleAlert, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { isProviderConfigured } from '@/lib/ai/provider-configured';
import { AI_PROVIDERS, type AiProviderId, type AiProviderListing } from '@/lib/ai/types';
import { SettingRow, SubsectionHeader } from './shared';

// ── Shared input styling ─────────────────────────────────
// Not extracted to `ui/input.tsx` — this is the only place in the app that
// needs a free-text field, so a shared primitive would be one more file for
// a single caller. If a second consumer appears, promote this to `ui/`.

// Width is applied per call site rather than baked in: the rows follow the
// SettingRow pattern (label left, control right), and the API key field shares
// its row with a Save/Remove button so it has to be narrower than the others.
const INPUT_CLASS =
  'rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500';

// ── Test-connection state ────────────────────────────────

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok' }
  | { status: 'error'; message: string };

// ── Component ─────────────────────────────────────────────

export default function AiSection() {
  const { settings, updateSettings } = useSettings();
  const [listings, setListings] = useState<AiProviderListing[]>([]);
  const [expanded, setExpanded] = useState<AiProviderId | null>(null);

  const refreshListings = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<AiProviderListing[]>('list_ai_providers');
      setListings(result);
    } catch {
      // Not in Tauri (e.g. plain `pnpm dev`) — no keychain to query, so
      // every provider is treated as key-less below.
      setListings([]);
    }
  }, []);

  useEffect(() => {
    refreshListings();
  }, [refreshListings]);

  const hasApiKey = (id: AiProviderId) =>
    listings.find((l) => l.provider === id)?.hasApiKey ?? false;

  return (
    <div className="space-y-6">
      <div>
        <SubsectionHeader title="Providers" />
        <div className="divide-y divide-neutral-200 rounded-lg bg-white px-4 dark:divide-slate-700/50 dark:bg-slate-800/50">
          {AI_PROVIDERS.map((meta) => (
            <ProviderRow
              key={meta.id}
              id={meta.id}
              label={meta.label}
              needsApiKey={meta.needsApiKey}
              needsBaseUrl={meta.needsBaseUrl}
              modelPlaceholder={meta.modelPlaceholder}
              config={settings.ai.providers[meta.id]}
              configured={isProviderConfigured(
                meta.id,
                settings.ai.providers[meta.id],
                hasApiKey(meta.id)
              )}
              hasApiKey={hasApiKey(meta.id)}
              expanded={expanded === meta.id}
              onToggle={() => setExpanded((cur) => (cur === meta.id ? null : meta.id))}
              onModelChange={(model) =>
                updateSettings({
                  ai: {
                    ...settings.ai,
                    providers: {
                      ...settings.ai.providers,
                      [meta.id]: { ...settings.ai.providers[meta.id], model },
                    },
                  },
                })
              }
              onBaseUrlChange={(baseUrl) =>
                updateSettings({
                  ai: {
                    ...settings.ai,
                    providers: {
                      ...settings.ai.providers,
                      [meta.id]: { ...settings.ai.providers[meta.id], baseUrl },
                    },
                  },
                })
              }
              onKeyChanged={refreshListings}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Provider row ──────────────────────────────────────────

interface ProviderRowProps {
  id: AiProviderId;
  label: string;
  needsApiKey: boolean;
  needsBaseUrl: boolean;
  modelPlaceholder: string;
  config: { model: string; baseUrl?: string };
  configured: boolean;
  hasApiKey: boolean;
  expanded: boolean;
  onToggle: () => void;
  onModelChange: (model: string) => void;
  onBaseUrlChange: (baseUrl: string) => void;
  onKeyChanged: () => void;
}

function ProviderRow({
  id,
  label,
  needsApiKey,
  needsBaseUrl,
  modelPlaceholder,
  config,
  configured,
  hasApiKey,
  expanded,
  onToggle,
  onModelChange,
  onBaseUrlChange,
  onKeyChanged,
}: ProviderRowProps) {
  const [keyDraft, setKeyDraft] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });

  const saveKey = async (value: string) => {
    setSavingKey(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_ai_api_key', { provider: id, apiKey: value });
      setKeyDraft('');
      onKeyChanged();
    } catch {
      // Not in Tauri, or the keychain write failed — the draft stays in the
      // field so the user can see what they typed and retry, rather than
      // silently discarding it.
    } finally {
      setSavingKey(false);
    }
  };

  const removeKey = async () => {
    setSavingKey(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_ai_api_key', { provider: id });
      onKeyChanged();
    } catch {
      // Not in Tauri, or the keychain delete failed — nothing more to do
      // here; the "Configured" state simply won't have changed.
    } finally {
      setSavingKey(false);
    }
  };

  const runTest = async () => {
    setTestState({ status: 'testing' });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('test_ai_provider', {
        config: { provider: id, model: config.model, baseUrl: config.baseUrl },
      });
      setTestState({ status: 'ok' });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'AI is unavailable outside the desktop app.';
      setTestState({ status: 'error', message });
    }
  };

  return (
    <div className="py-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="size-3.5 text-neutral-400 dark:text-slate-500" />
          ) : (
            <ChevronRight className="size-3.5 text-neutral-400 dark:text-slate-500" />
          )}
          <span className="text-sm font-medium text-neutral-700 dark:text-slate-200">{label}</span>
        </span>
        {configured && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            Configured
          </span>
        )}
      </button>

      {expanded && (
        // Same divided-row rhythm as the General and Editor sections, indented
        // under the provider it belongs to.
        <div className="mt-1 divide-y divide-neutral-200 pl-5 dark:divide-slate-700/50">
          {needsApiKey && (
            <SettingRow label="API Key">
              {hasApiKey ? (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value="••••••••"
                    disabled
                    className={`${INPUT_CLASS} w-40`}
                    aria-label={`${label} API key (saved)`}
                  />
                  <Button size="sm" variant="outline" disabled={savingKey} onClick={removeKey}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    onBlur={() => {
                      if (keyDraft.trim()) saveKey(keyDraft.trim());
                    }}
                    placeholder="sk-…"
                    disabled={savingKey}
                    className={`${INPUT_CLASS} w-40`}
                    aria-label={`${label} API key`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={savingKey || !keyDraft.trim()}
                    onClick={() => saveKey(keyDraft.trim())}
                  >
                    Save
                  </Button>
                </div>
              )}
            </SettingRow>
          )}

          <SettingRow label="Model">
            <input
              type="text"
              value={config.model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder={modelPlaceholder}
              className={`${INPUT_CLASS} w-56`}
              aria-label={`${label} model`}
            />
          </SettingRow>

          {needsBaseUrl && (
            <SettingRow label="Base URL">
              <input
                type="text"
                value={config.baseUrl ?? ''}
                onChange={(e) => onBaseUrlChange(e.target.value)}
                placeholder="http://localhost:11434"
                className={`${INPUT_CLASS} w-56`}
                aria-label={`${label} base URL`}
              />
            </SettingRow>
          )}

          <SettingRow label="Connection">
            <div className="flex items-center gap-2">
              {testState.status === 'ok' && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  OK
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={runTest}
                disabled={testState.status === 'testing'}
              >
                {testState.status === 'testing' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Zap className="size-3.5" />
                )}
                Test
              </Button>
            </div>
          </SettingRow>

          {/* Errors get their own full-width line below the row rather than
              sharing it with the button: a provider's message is the whole
              point of testing ("Model 'x' not found"), and squeezing it beside
              a control truncated away the part that identifies the problem. */}
          {testState.status === 'error' && (
            <div className="flex items-start gap-1.5 py-2 text-xs text-red-600 dark:text-red-400">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span className="break-words">{testState.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
