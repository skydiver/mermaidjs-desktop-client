import {
  AI_PANEL_WIDTH_MAX,
  AI_PANEL_WIDTH_MIN,
  type AiSettings,
  type AppSettings,
  DEFAULT_SETTINGS,
  type DiagramView,
  type ThemePreference,
} from '@/hooks/useSettings';
import { AI_PROVIDERS, type AiProviderConfig, type AiProviderId } from '@/lib/ai/types';
import { CSS_SAFE_FONT_FAMILY_PATTERN } from '@/lib/css-safe-font';

// ── Constants ───────────────────────────────────────────

const INDENT_SIZES = new Set<AppSettings['indentSize']>([2, 4, 8]);
const INDENT_TYPES = new Set<AppSettings['indentType']>(['space', 'tab']);
const THEME_VALUES = new Set<ThemePreference>(['system', 'light', 'dark']);
const DIAGRAM_VIEW_VALUES = new Set<DiagramView>(['fit', 'actual']);
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;
const AI_PROVIDER_IDS = new Set<AiProviderId>(AI_PROVIDERS.map((p) => p.id));

// ── Helpers ─────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pickEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === 'string' && allowed.has(value as T) ? (value as T) : fallback;
}

function pickIndentSize(value: unknown): AppSettings['indentSize'] {
  return typeof value === 'number' && INDENT_SIZES.has(value as AppSettings['indentSize'])
    ? (value as AppSettings['indentSize'])
    : DEFAULT_SETTINGS.indentSize;
}

function pickFontSize(value: unknown): number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= FONT_SIZE_MIN &&
    value <= FONT_SIZE_MAX
    ? value
    : DEFAULT_SETTINGS.editorFontSize;
}

function pickFontFamily(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_SETTINGS.editorFontFamily;
  if (value === '') return '';
  return CSS_SAFE_FONT_FAMILY_PATTERN.test(value) ? value : DEFAULT_SETTINGS.editorFontFamily;
}

function pickAiPanelWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.aiPanelWidth;
  return Math.min(AI_PANEL_WIDTH_MAX, Math.max(AI_PANEL_WIDTH_MIN, value));
}

function pickProviderConfig(value: unknown, fallback: AiProviderConfig): AiProviderConfig {
  if (!isPlainObject(value)) return fallback;

  const model = typeof value.model === 'string' ? value.model : fallback.model;

  // `baseUrl` is optional — omitted entirely (rather than defaulted to `''`)
  // when neither the persisted value nor the fallback provides a string, so
  // a provider that doesn't use one never gets a spurious empty baseUrl.
  const rawBaseUrl = 'baseUrl' in value ? value.baseUrl : undefined;
  const baseUrl = typeof rawBaseUrl === 'string' ? rawBaseUrl : fallback.baseUrl;

  return baseUrl === undefined ? { model } : { model, baseUrl };
}

/**
 * Validates `settings.ai`. Unknown provider keys are dropped and each of the
 * four known providers is validated independently against its own default —
 * a malformed entry for one provider cannot corrupt another's config nor
 * silently smuggle an unrecognized provider id through to application code
 * that assumes exactly the four known ids.
 */
function pickAiSettings(value: unknown): AiSettings {
  const fallback = DEFAULT_SETTINGS.ai;
  const source = isPlainObject(value) ? value : {};

  const activeProvider =
    typeof source.activeProvider === 'string' &&
    AI_PROVIDER_IDS.has(source.activeProvider as AiProviderId)
      ? (source.activeProvider as AiProviderId)
      : null;

  const rawProviders = isPlainObject(source.providers) ? source.providers : {};
  const providers = Object.fromEntries(
    AI_PROVIDERS.map((meta) => [
      meta.id,
      pickProviderConfig(rawProviders[meta.id], fallback.providers[meta.id]),
    ])
  ) as AiSettings['providers'];

  return { activeProvider, providers };
}

// ── Validation ──────────────────────────────────────────

/**
 * Validates an untrusted, parsed value from the persisted settings store
 * and returns a fully-valid `AppSettings`. Each field is validated
 * independently against `DEFAULT_SETTINGS` — one bad field falls back to
 * its default without discarding the user's other valid settings. Unknown
 * keys are dropped rather than spread through.
 */
export function validateSettings(raw: unknown): AppSettings {
  const source = isPlainObject(raw) ? raw : {};

  return {
    theme: pickEnum(source.theme, THEME_VALUES, DEFAULT_SETTINGS.theme),
    diagramTheme: pickEnum(source.diagramTheme, THEME_VALUES, DEFAULT_SETTINGS.diagramTheme),
    autoSave: pickBoolean(source.autoSave, DEFAULT_SETTINGS.autoSave),
    editorFontFamily: pickFontFamily(source.editorFontFamily),
    editorFontSize: pickFontSize(source.editorFontSize),
    syntaxHighlighting: pickBoolean(source.syntaxHighlighting, DEFAULT_SETTINGS.syntaxHighlighting),
    wordWrap: pickBoolean(source.wordWrap, DEFAULT_SETTINGS.wordWrap),
    showInvisibles: pickBoolean(source.showInvisibles, DEFAULT_SETTINGS.showInvisibles),
    disableLigatures: pickBoolean(source.disableLigatures, DEFAULT_SETTINGS.disableLigatures),
    indentType: pickEnum(source.indentType, INDENT_TYPES, DEFAULT_SETTINGS.indentType),
    indentSize: pickIndentSize(source.indentSize),
    showDotGrid: pickBoolean(source.showDotGrid, DEFAULT_SETTINGS.showDotGrid),
    defaultDiagramView: pickEnum(
      source.defaultDiagramView,
      DIAGRAM_VIEW_VALUES,
      DEFAULT_SETTINGS.defaultDiagramView
    ),
    aiPanelWidth: pickAiPanelWidth(source.aiPanelWidth),
    ai: pickAiSettings(source.ai),
  };
}
