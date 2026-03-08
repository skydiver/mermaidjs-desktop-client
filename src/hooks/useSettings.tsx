import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ── Types ───────────────────────────────────────────────

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  theme: ThemePreference;
  editorFontFamily: string;
  editorFontSize: number;
  syntaxHighlighting: boolean;
  wordWrap: boolean;
  showInvisibles: boolean;
  disableLigatures: boolean;
  indentType: 'space' | 'tab';
  indentSize: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  editorFontFamily: '',
  editorFontSize: 14,
  syntaxHighlighting: true,
  wordWrap: true,
  showInvisibles: false,
  disableLigatures: false,
  indentType: 'space',
  indentSize: 2,
};

export interface SettingsContextValue {
  settings: AppSettings;
  isDark: boolean;
  updateSettings(patch: Partial<AppSettings>): void;
  resetSettings(): void;
}

// ── Context ─────────────────────────────────────────────

const SettingsContext = createContext<SettingsContextValue | null>(null);

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

async function loadFromStore(): Promise<Partial<AppSettings>> {
  try {
    const store = await getStore();
    const value = await store.get<AppSettings>(STORE_KEY);
    return value ?? {};
  } catch {
    return {};
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted settings on mount
  useEffect(() => {
    loadFromStore().then((persisted) => {
      setSettings((prev) => ({ ...prev, ...persisted }));
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
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Debounced persistence
  const persistSettings = useCallback((next: AppSettings) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToStore(next);
    }, DEBOUNCE_MS);
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
    () => ({ settings, isDark, updateSettings, resetSettings }),
    [settings, isDark, updateSettings, resetSettings]
  );

  // Don't render children until store is loaded to avoid flash
  if (!loaded) return null;

  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
}
