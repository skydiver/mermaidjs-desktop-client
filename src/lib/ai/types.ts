// ── Types ───────────────────────────────────────────────

/**
 * The four providers the Rust backend supports. Kept in sync with the
 * `AiProviderId` union used by `list_ai_providers`/`save_ai_api_key`/etc —
 * any drift here would surface as a runtime string mismatch across the IPC
 * boundary rather than a compile error, so this is the one place to update
 * when the backend contract changes.
 */
export type AiProviderId = 'anthropic' | 'openai' | 'ollama' | 'openai-compatible';

/** Per-provider configuration persisted in `settings.json` (no secrets). */
export interface AiProviderConfig {
  model: string;
  baseUrl?: string;
}

/** What `send_ai_message` is given for the model, plus a locally-generated id. */
export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/** Result of `list_ai_providers` — whether a key already exists in the keychain. */
export interface AiProviderListing {
  provider: AiProviderId;
  hasApiKey: boolean;
}

// ── Streaming ───────────────────────────────────────────

export interface AiStreamTextDelta {
  type: 'text-delta';
  streamId: string;
  text: string;
}

export interface AiStreamDone {
  type: 'done';
  streamId: string;
  tokensIn: number;
  tokensOut: number;
}

export interface AiStreamError {
  type: 'error';
  streamId: string;
  message: string;
}

export type AiStreamChunk = AiStreamTextDelta | AiStreamDone | AiStreamError;

// ── Provider metadata ───────────────────────────────────

export interface AiProviderMeta {
  id: AiProviderId;
  label: string;
  /** Whether this provider needs an API key saved in the OS keychain. */
  needsApiKey: boolean;
  /** Whether this provider needs a base URL (self-hosted / compatible endpoints). */
  needsBaseUrl: boolean;
  /** Pre-filled default for `baseUrl`, if any (Ollama's local default). */
  defaultBaseUrl?: string;
  /** Placeholder shown in the model text input, illustrating the expected format. */
  modelPlaceholder: string;
}

export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434';

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    needsApiKey: true,
    needsBaseUrl: false,
    modelPlaceholder: 'claude-sonnet-4-5',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    needsApiKey: true,
    needsBaseUrl: false,
    modelPlaceholder: 'gpt-4o',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    needsApiKey: false,
    needsBaseUrl: true,
    defaultBaseUrl: OLLAMA_DEFAULT_BASE_URL,
    modelPlaceholder: 'llama3.2',
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI Compatible',
    needsApiKey: true,
    needsBaseUrl: true,
    modelPlaceholder: 'gpt-4o',
  },
];
