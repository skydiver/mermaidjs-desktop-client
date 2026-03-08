import { Store } from '@tauri-apps/plugin-store';
import mermaid from 'mermaid';

const THEME_KEY = 'appTheme';

export type AppTheme = 'light' | 'dark';

export interface ThemeController {
  theme: AppTheme;
  toggle(): void;
  apply(): void;
}

export async function setupTheme(store: Store | null): Promise<ThemeController> {
  let currentTheme: AppTheme = 'light';
  if (store) {
    const saved = await store.get<AppTheme>(THEME_KEY);
    if (saved) {
      currentTheme = saved;
    }
  }
  document.documentElement.dataset.theme = currentTheme;

  const applyTheme = () => {
    document.body.classList.toggle('dark', currentTheme === 'dark');
    document.documentElement.dataset.theme = currentTheme;

    // Update toggle button icon and tooltip
    const toggleBtn = document.querySelector<HTMLButtonElement>('[data-action="toggle-theme"]');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        icon.className = currentTheme === 'dark' ? 'ri-sun-line' : 'ri-moon-line';
      }
      toggleBtn.setAttribute('data-tooltip', currentTheme === 'dark' ? 'Light mode' : 'Dark mode');
      toggleBtn.setAttribute(
        'aria-label',
        currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      );
    }

    // Update Mermaid default configuration
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: currentTheme === 'dark' ? 'dark' : 'default',
    });

    // Trigger a custom event so other components (like the preview) know to re-render
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: currentTheme } }));
  };

  const controller: ThemeController = {
    get theme() {
      return currentTheme;
    },
    async toggle() {
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      if (store) {
        await store.set(THEME_KEY, currentTheme);
        await store.save();
      }
      applyTheme();
    },
    apply() {
      applyTheme();
    },
  };

  // Initial apply
  applyTheme();

  return controller;
}
