import { Bot, CheckCircle2, Loader2, TriangleAlert, Zap } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { isProviderConfigured } from '@/lib/ai/provider-configured';
import { notifyProvidersChanged } from '@/lib/ai/provider-events';
import { AI_PROVIDERS, type AiProviderId, type AiProviderListing } from '@/lib/ai/types';
import { SubsectionHeader } from './shared';

// ── Shared input styling ─────────────────────────────────
// Not extracted to `ui/input.tsx` — this is the only place in the app that
// needs a free-text field, so a shared primitive would be one more file for
// a single caller. If a second consumer appears, promote this to `ui/`.
//
// Full-width by design: these fields hold model names, URLs and keys, all of
// which are long enough that a right-aligned control in a SettingRow truncated
// them. They are stacked in labelled blocks instead of the label-left rhythm
// the other sections use.
const INPUT_CLASS =
  'w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500';

// Fixed ids rather than `useId`: exactly one provider's fields are on screen
// at a time, so there is no collision to avoid, and a stable id keeps the
// label/input pairing readable in the markup.
const MODEL_ID = 'ai-model';
const BASE_URL_ID = 'ai-base-url';
const API_KEY_ID = 'ai-api-key';

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
  // Which provider's fields are on screen. Purely an editing cursor — every
  // provider stays configured independently, and which one the chat actually
  // uses is chosen from the AI panel's dropdown. Opens on the active provider
  // so the most likely thing to edit is already in front of the user.
  const [selected, setSelected] = useState<AiProviderId>(
    () => settings.ai.activeProvider ?? AI_PROVIDERS[0].id
  );

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

  const meta = AI_PROVIDERS.find((p) => p.id === selected) ?? AI_PROVIDERS[0];

  return (
    <div className="space-y-4">
      {/* Amber rather than red: the feature works, it is just not settled yet.
          Sits above everything else in the section so it is read before any
          provider is set up, not after. */}
      <div className="flex items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
        <TriangleAlert className="size-5 shrink-0" />
        <p>
          <span className="font-medium">Experimental.</span> AI diagram generation is still under
          development — results vary by provider and model, and this settings layout may change.
        </p>
      </div>

      <div>
        <SubsectionHeader title="AI provider & model" />
        <div className="grid grid-cols-4 gap-3">
          {AI_PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider.id}
              label={provider.label}
              description={provider.description}
              selected={provider.id === selected}
              configured={isProviderConfigured(
                provider.id,
                settings.ai.providers[provider.id],
                hasApiKey(provider.id)
              )}
              onSelect={() => setSelected(provider.id)}
            />
          ))}
        </div>
      </div>

      {/* Remounted per provider (`key`) so the API key draft and the last test
          result belong to the provider they were produced for — without it,
          switching cards would carry a failed Anthropic test over to OpenAI. */}
      <ProviderFields
        key={meta.id}
        meta={meta}
        config={settings.ai.providers[meta.id]}
        hasApiKey={hasApiKey(meta.id)}
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
    </div>
  );
}

// ── Provider card ─────────────────────────────────────────

interface ProviderCardProps {
  label: string;
  description: string;
  selected: boolean;
  configured: boolean;
  onSelect: () => void;
}

function ProviderCard({ label, description, selected, configured, onSelect }: ProviderCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-100 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/50'
      }`}
    >
      {/* A tick in the corner rather than a "Configured" pill: the cards are
          narrow, and the pill either wrapped or pushed the label off-centre. */}
      {configured && (
        <CheckCircle2
          className="absolute right-1.5 top-1.5 size-3.5 text-emerald-600 dark:text-emerald-400"
          aria-label="Configured"
        />
      )}
      <Bot className="size-5 text-neutral-400 dark:text-slate-400" />
      <span className="text-sm font-medium text-neutral-800 dark:text-slate-200">{label}</span>
      <span className="text-center text-xs text-neutral-400 dark:text-slate-500">
        {description}
      </span>
    </button>
  );
}

// ── Provider fields ───────────────────────────────────────

interface ProviderFieldsProps {
  meta: (typeof AI_PROVIDERS)[number];
  config: { model: string; baseUrl?: string };
  hasApiKey: boolean;
  onModelChange: (model: string) => void;
  onBaseUrlChange: (baseUrl: string) => void;
  onKeyChanged: () => void;
}

function ProviderFields({
  meta,
  config,
  hasApiKey,
  onModelChange,
  onBaseUrlChange,
  onKeyChanged,
}: ProviderFieldsProps) {
  const [keyDraft, setKeyDraft] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });

  const saveKey = async (value: string) => {
    setSavingKey(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_ai_api_key', { provider: meta.id, apiKey: value });
      setKeyDraft('');
      onKeyChanged();
      // A keychain write is invisible to React state, so anything else
      // deriving "is this provider usable" — the AI panel, via
      // useConfiguredProviders — has to be told to re-read it.
      notifyProvidersChanged();
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
      await invoke('delete_ai_api_key', { provider: meta.id });
      onKeyChanged();
      // Removing a key can make a provider unusable while it is the active
      // one; the panel has to re-read so it can fall back or empty out.
      notifyProvidersChanged();
    } catch {
      // Not in Tauri, or the keychain delete failed — nothing more to do
      // here; the "Configured" tick simply won't have changed.
    } finally {
      setSavingKey(false);
    }
  };

  const runTest = async () => {
    setTestState({ status: 'testing' });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('test_ai_provider', {
        config: { provider: meta.id, model: config.model, baseUrl: config.baseUrl },
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
    <div className="space-y-3">
      <Field htmlFor={MODEL_ID} label="Model">
        <input
          id={MODEL_ID}
          type="text"
          value={config.model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder={meta.modelPlaceholder}
          className={INPUT_CLASS}
        />
      </Field>

      {meta.needsBaseUrl && (
        <Field
          htmlFor={BASE_URL_ID}
          label={meta.id === 'ollama' ? 'Base URL' : 'Chat Completions URL'}
          hint={
            meta.id === 'ollama'
              ? 'No API key needed — runs locally'
              : "Full URL to the provider's /chat/completions endpoint"
          }
        >
          <input
            id={BASE_URL_ID}
            type="text"
            value={config.baseUrl ?? ''}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder={meta.defaultBaseUrl ?? 'https://api.example.com/v1/chat/completions'}
            className={INPUT_CLASS}
          />
        </Field>
      )}

      {meta.needsApiKey && (
        <Field htmlFor={API_KEY_ID} label="API Key" hint="Stored securely in the system keychain">
          <div className="flex items-center gap-2">
            <input
              id={API_KEY_ID}
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              onBlur={() => {
                if (keyDraft.trim()) saveKey(keyDraft.trim());
              }}
              // A saved key is never read back out of the keychain, so the
              // field stays empty and says so: typing here replaces it.
              placeholder={hasApiKey ? '(unchanged)' : 'sk-…'}
              disabled={savingKey}
              className={INPUT_CLASS}
            />
            {keyDraft.trim() ? (
              <Button
                size="sm"
                variant="outline"
                disabled={savingKey}
                onClick={() => saveKey(keyDraft.trim())}
              >
                Save
              </Button>
            ) : (
              hasApiKey && (
                <Button size="sm" variant="outline" disabled={savingKey} onClick={removeKey}>
                  Remove
                </Button>
              )
            )}
          </div>
        </Field>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {testState.status === 'ok' && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Connection OK
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
          Test connection
        </Button>
      </div>

      {/* Errors get their own full-width line rather than sharing one with the
          button: a provider's message is the whole point of testing ("Model 'x'
          not found"), and squeezing it beside a control truncated away the part
          that identifies the problem. */}
      {testState.status === 'error' && (
        <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-words">{testState.message}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Label above, control below, optional hint underneath.
 *
 * `htmlFor` is required rather than optional: the control is passed in as
 * children, so nothing here can verify that one exists — an explicit id is the
 * only thing tying the two together, for a screen reader and for a click on the
 * label text alike.
 */
function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-neutral-500 dark:text-slate-400">
        {label}
      </label>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-neutral-400 dark:text-slate-500">{hint}</span>
      )}
    </div>
  );
}
