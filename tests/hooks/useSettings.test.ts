import { describe, expect, it } from 'vitest';
import { type AppSettings, DEFAULT_SETTINGS } from '../../src/hooks/useSettings';

describe('DEFAULT_SETTINGS', () => {
  it('has system theme by default', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('system');
  });

  it('has sensible editor defaults', () => {
    expect(DEFAULT_SETTINGS.editorFontSize).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.syntaxHighlighting).toBe(true);
  });

  it('has all required keys', () => {
    const keys: (keyof AppSettings)[] = [
      'theme',
      'editorFontFamily',
      'editorFontSize',
      'syntaxHighlighting',
      'aiPanelWidth',
      'ai',
    ];
    for (const key of keys) {
      expect(DEFAULT_SETTINGS).toHaveProperty(key);
    }
  });
});

describe('DEFAULT_SETTINGS.ai', () => {
  it('has no active provider by default', () => {
    expect(DEFAULT_SETTINGS.ai.activeProvider).toBeNull();
  });

  it('has a sensible default panel width', () => {
    expect(DEFAULT_SETTINGS.aiPanelWidth).toBe(360);
  });

  it('has all four providers present with an empty model', () => {
    for (const id of ['anthropic', 'openai', 'ollama', 'openai-compatible'] as const) {
      expect(DEFAULT_SETTINGS.ai.providers).toHaveProperty(id);
      expect(DEFAULT_SETTINGS.ai.providers[id].model).toBe('');
    }
  });

  it('pre-fills the Ollama base URL to the local default', () => {
    expect(DEFAULT_SETTINGS.ai.providers.ollama.baseUrl).toBe('http://localhost:11434');
  });
});
