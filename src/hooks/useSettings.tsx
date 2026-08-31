import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AI_PROVIDERS, type AiProviderConfig, type AiProviderId } from '../lib/ai/types';
import { debounce } from '../lib/debounce';
import { validateSettings } from '../lib/settings/validate-settings';

// ── Types ───────────────────────────────────────────────

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AiSettings {
  activeProvider: AiProviderId | null;
  providers: Record<AiProviderId, AiProviderConfig>;
}

export interface AppSettings {
  theme: ThemePreference;
  diagramTheme: ThemePreference;
  autoSave: boolean;
  editorFontFamily: string;
  editorFontSize: number;
  syntaxHighlighting: boolean;
  wordWrap: boolean;
  showInvisibles: boolean;
  disableLigatures: boolean;
  indentType: 'space' | 'tab';
  indentSize: number;
  showDotGrid: boolean;
  /** Width in px of the AI panel, clamped to [280, 600] by `validateSettings`. */
  aiPanelWidth: number;
  ai: AiSettings;
}

// Built from `AI_PROVIDERS` rather than listed by hand, so a provider added
// to that metadata array is automatically represented here — the two lists
// cannot silently drift apart.
function defaultAiProviders(): Record<AiProviderId, AiProviderConfig> {
  return Object.fromEntries(
    AI_PROVIDERS.map((meta) => [meta.id, { model: '', baseUrl: meta.defaultBaseUrl }])
  ) as Record<AiProviderId, AiProviderConfig>;
}

export const DEFAULT_AI_PANEL_WIDTH = 360;
export const AI_PANEL_WIDTH_MIN = 280;
/**
 * Absolute ceiling for the PERSISTED width. The width the panel may actually
 * take is half the workspace, computed at render time — but that depends on
 * the current window, which is unknown here and would change between sessions.
 * Storing the user's preferred width unclamped (up to this sanity bound) lets
 * a wide setting survive a spell on a smaller display: the panel is limited to
 * half the window while it is narrow, and returns to the preferred width when
 * there is room again.
 */
export const AI_PANEL_WIDTH_MAX = 2000;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  diagramTheme: 'system',
  autoSave: false,
  editorFontFamily: '',
  editorFontSize: 14,
  syntaxHighlighting: true,
  wordWrap: true,
  showInvisibles: false,
  disableLigatures: false,
  indentType: 'space',
  indentSize: 2,
  showDotGrid: true,
  aiPanelWidth: DEFAULT_AI_PANEL_WIDTH,
  ai: {
    activeProvider: null,
    providers: defaultAiProviders(),
  },
};

export interface SettingsContextValue {
  settings: AppSettings;
  isDiagramDark: boolean;
  updateSettings(patch: Partial<AppSettings>): void;
  resetSettings(): void;
}

// ── Context ─────────────────────────────────────────────

// Exported (not just `useSettings`) so tests can supply a context value
// directly via `<SettingsContext.Provider>`, bypassing `SettingsProvider`'s
// async store load — useful for hooks like `useAIChat` that only need a
// fixed `settings.ai` snapshot rather than the full persistence lifecycle.
export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

// ── Persistence helpers ─────────────────────────────────

const STORE_NAME = 'settings.json';
const STORE_KEY = 'app';
const DEBOUNCE_MS = 300;

let storePromise: Promise<
  InstanceType<typeof import('@tauri-apps/plugin-store')['LazyStore']>
> | null = null;

function getStore() {
  if (!storePromise) {
    storePromise = import('@tauri-apps/plugin-store').then(
      ({ LazyStore }) => new LazyStore(STORE_NAME)
    );
  }
  return storePromise;
}

async function loadFromStore(): Promise<AppSettings> {
  try {
    const store = await getStore();
    // `settings.json` is a trust boundary — it is a plain file writable by
    // the user or any local process. `store.get` returns `unknown` at
    // runtime despite the type parameter, so it must be validated before
    // it reaches application state.
    const value = await store.get(STORE_KEY);
    return validateSettings(value);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveToStore(settings: AppSettings): Promise<void> {
  try {
    const store = await getStore();
    await store.set(STORE_KEY, settings);
    await store.save();
  } catch {
    // Store unavailable (e.g. Vite-only mode)
  }
}

// ── Dark mode resolution ────────────────────────────────

function resolveIsDark(theme: ThemePreference, osPrefersDark: boolean): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return osPrefersDark;
}

// ── Provider ────────────────────────────────────────────

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [osPrefersDark, setOsPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [loaded, setLoaded] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    loadFromStore().then((validated) => {
      setSettings(validated);
      setLoaded(true);
    });
  }, []);

  // Listen for OS dark mode changes
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setOsPrefersDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Apply dark class on <html>
  const isDark = resolveIsDark(settings.theme, osPrefersDark);
  const isDiagramDark = resolveIsDark(settings.diagramTheme, osPrefersDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Debounced persistence
  const [persistSettings] = useState(() => debounce(saveToStore, DEBOUNCE_MS));

  // Cancel pending save on unmount
  useEffect(() => {
    return () => persistSettings.cancel();
  }, [persistSettings]);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persistSettings(next);
        return next;
      });
    },
    [persistSettings]
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    persistSettings(DEFAULT_SETTINGS);
  }, [persistSettings]);

  const contextValue = useMemo(
    () => ({ settings, isDiagramDark, updateSettings, resetSettings }),
    [settings, isDiagramDark, updateSettings, resetSettings]
  );

  // Don't render children until store is loaded to avoid flash
  if (!loaded) return null;

  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
}
