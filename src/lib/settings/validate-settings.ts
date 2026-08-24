import { type AppSettings, DEFAULT_SETTINGS, type ThemePreference } from '@/hooks/useSettings';
import { CSS_SAFE_FONT_FAMILY_PATTERN } from '@/lib/css-safe-font';

// ── Constants ───────────────────────────────────────────

const INDENT_SIZES = new Set<AppSettings['indentSize']>([2, 4, 8]);
const INDENT_TYPES = new Set<AppSettings['indentType']>(['space', 'tab']);
const THEME_VALUES = new Set<ThemePreference>(['system', 'light', 'dark']);
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;

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
  };
}
