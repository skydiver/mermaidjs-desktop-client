import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../src/hooks/useSettings';
import { validateSettings } from '../../../src/lib/settings/validate-settings';

describe('validateSettings', () => {
  it('returns clean defaults for null', () => {
    expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns clean defaults for undefined', () => {
    expect(validateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns clean defaults for a non-object', () => {
    expect(validateSettings('not an object')).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns clean defaults for an array', () => {
    expect(validateSettings([1, 2, 3])).toEqual(DEFAULT_SETTINGS);
  });

  it('drops an unknown extra key rather than spreading it through', () => {
    const result = validateSettings({ notARealSetting: 'hax' });
    expect(result).toEqual(DEFAULT_SETTINGS);
    expect(result).not.toHaveProperty('notARealSetting');
  });

  it('replaces a negative indentSize with the default, preserving other fields', () => {
    const result = validateSettings({ indentSize: -1, wordWrap: false });
    expect(result.indentSize).toBe(DEFAULT_SETTINGS.indentSize);
    expect(result.wordWrap).toBe(false);
  });

  it('replaces an absurdly large indentSize with the default', () => {
    const result = validateSettings({ indentSize: 1000000000 });
    expect(result.indentSize).toBe(DEFAULT_SETTINGS.indentSize);
  });

  it('accepts each whitelisted indentSize value', () => {
    for (const size of [2, 4, 8]) {
      expect(validateSettings({ indentSize: size }).indentSize).toBe(size);
    }
  });

  it('rejects an editorFontFamily containing a CSS-injection payload', () => {
    const payload = 'x"; } .cm-content { display: none } .x { font-family: "y';
    const result = validateSettings({ editorFontFamily: payload });
    expect(result.editorFontFamily).toBe(DEFAULT_SETTINGS.editorFontFamily);
  });

  it('preserves a legitimate font family name', () => {
    expect(validateSettings({ editorFontFamily: 'JetBrains Mono' }).editorFontFamily).toBe(
      'JetBrains Mono'
    );
    expect(validateSettings({ editorFontFamily: 'SF Mono' }).editorFontFamily).toBe('SF Mono');
    expect(validateSettings({ editorFontFamily: 'IBM Plex Mono' }).editorFontFamily).toBe(
      'IBM Plex Mono'
    );
    expect(validateSettings({ editorFontFamily: 'PT Mono' }).editorFontFamily).toBe('PT Mono');
    expect(validateSettings({ editorFontFamily: 'Fira_Code-Retina' }).editorFontFamily).toBe(
      'Fira_Code-Retina'
    );
  });

  it('clamps editorFontSize below the minimum to the default', () => {
    expect(validateSettings({ editorFontSize: 1 }).editorFontSize).toBe(
      DEFAULT_SETTINGS.editorFontSize
    );
  });

  it('clamps editorFontSize above the maximum to the default', () => {
    expect(validateSettings({ editorFontSize: 999 }).editorFontSize).toBe(
      DEFAULT_SETTINGS.editorFontSize
    );
  });

  it('accepts editorFontSize within [10,24]', () => {
    expect(validateSettings({ editorFontSize: 10 }).editorFontSize).toBe(10);
    expect(validateSettings({ editorFontSize: 24 }).editorFontSize).toBe(24);
    expect(validateSettings({ editorFontSize: 18 }).editorFontSize).toBe(18);
  });

  it('falls back on an invalid enum value while sibling valid fields survive', () => {
    const result = validateSettings({ theme: 'rainbow', autoSave: true });
    expect(result.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(result.autoSave).toBe(true);
  });

  it('narrows theme to its allowed literal union', () => {
    for (const value of ['system', 'light', 'dark'] as const) {
      expect(validateSettings({ theme: value }).theme).toBe(value);
    }
  });

  it('narrows diagramTheme to its allowed literal union', () => {
    expect(validateSettings({ diagramTheme: 'dark' }).diagramTheme).toBe('dark');
    expect(validateSettings({ diagramTheme: 'bogus' }).diagramTheme).toBe(
      DEFAULT_SETTINGS.diagramTheme
    );
  });

  it('narrows indentType to its allowed literal union', () => {
    expect(validateSettings({ indentType: 'tab' }).indentType).toBe('tab');
    expect(validateSettings({ indentType: 'bogus' }).indentType).toBe(DEFAULT_SETTINGS.indentType);
  });

  it('coerces boolean fields, falling back on non-boolean values', () => {
    expect(validateSettings({ autoSave: 'yes' }).autoSave).toBe(DEFAULT_SETTINGS.autoSave);
    expect(validateSettings({ syntaxHighlighting: 1 }).syntaxHighlighting).toBe(
      DEFAULT_SETTINGS.syntaxHighlighting
    );
    expect(validateSettings({ wordWrap: false }).wordWrap).toBe(false);
    expect(validateSettings({ showInvisibles: true }).showInvisibles).toBe(true);
    expect(validateSettings({ disableLigatures: true }).disableLigatures).toBe(true);
    expect(validateSettings({ showDotGrid: false }).showDotGrid).toBe(false);
  });

  it('keeps all valid fields of a valid partial object', () => {
    const partial = { theme: 'dark' as const, editorFontSize: 16, wordWrap: false };
    expect(validateSettings(partial)).toEqual({ ...DEFAULT_SETTINGS, ...partial });
  });

  it('returns a fully-populated AppSettings for a valid full object', () => {
    const full = {
      theme: 'dark' as const,
      diagramTheme: 'light' as const,
      autoSave: true,
      editorFontFamily: 'Menlo',
      editorFontSize: 20,
      syntaxHighlighting: false,
      wordWrap: false,
      showInvisibles: true,
      disableLigatures: true,
      indentType: 'tab' as const,
      indentSize: 4,
      showDotGrid: false,
      aiPanelWidth: 420,
      ai: {
        activeProvider: 'anthropic' as const,
        providers: {
          anthropic: { model: 'claude-sonnet-4-5' },
          openai: { model: 'gpt-4o' },
          ollama: { model: 'llama3.2', baseUrl: 'http://localhost:11434' },
          'openai-compatible': { model: 'gpt-4o', baseUrl: 'https://example.com/v1' },
        },
      },
    };
    expect(validateSettings(full)).toEqual(full);
  });
});

describe('validateSettings — ai block', () => {
  it('defaults aiPanelWidth when missing', () => {
    expect(validateSettings({}).aiPanelWidth).toBe(DEFAULT_SETTINGS.aiPanelWidth);
  });

  it('clamps aiPanelWidth below the minimum', () => {
    expect(validateSettings({ aiPanelWidth: 10 }).aiPanelWidth).toBe(280);
  });

  it('clamps aiPanelWidth above the maximum', () => {
    expect(validateSettings({ aiPanelWidth: 9999 }).aiPanelWidth).toBe(600);
  });

  it('falls back to the default aiPanelWidth for a non-number', () => {
    expect(validateSettings({ aiPanelWidth: 'wide' }).aiPanelWidth).toBe(
      DEFAULT_SETTINGS.aiPanelWidth
    );
  });

  it('accepts a width within range unchanged', () => {
    expect(validateSettings({ aiPanelWidth: 450 }).aiPanelWidth).toBe(450);
  });

  it('defaults the whole ai block when missing', () => {
    expect(validateSettings({}).ai).toEqual(DEFAULT_SETTINGS.ai);
  });

  it('defaults ai when it is not an object', () => {
    expect(validateSettings({ ai: 'nope' }).ai).toEqual(DEFAULT_SETTINGS.ai);
  });

  it('narrows activeProvider to a known provider id', () => {
    expect(validateSettings({ ai: { activeProvider: 'openai' } }).ai.activeProvider).toBe('openai');
  });

  it('falls back activeProvider to null for an unknown provider id', () => {
    expect(validateSettings({ ai: { activeProvider: 'gemini' } }).ai.activeProvider).toBeNull();
  });

  it('drops an unknown provider key from ai.providers rather than passing it through', () => {
    const result = validateSettings({
      ai: { providers: { gemini: { model: 'gemini-pro' } } },
    });
    expect(result.ai.providers).not.toHaveProperty('gemini');
    expect(result.ai.providers).toEqual(DEFAULT_SETTINGS.ai.providers);
  });

  it('validates each provider config independently, keeping valid siblings', () => {
    const result = validateSettings({
      ai: {
        providers: {
          anthropic: { model: 'claude-sonnet-4-5' },
          openai: { model: 42 },
        },
      },
    });
    expect(result.ai.providers.anthropic).toEqual({ model: 'claude-sonnet-4-5' });
    expect(result.ai.providers.openai.model).toBe(DEFAULT_SETTINGS.ai.providers.openai.model);
  });

  it('rejects a non-string model, falling back to the default for that provider', () => {
    const result = validateSettings({ ai: { providers: { ollama: { model: 123 } } } });
    expect(result.ai.providers.ollama.model).toBe(DEFAULT_SETTINGS.ai.providers.ollama.model);
  });

  it('preserves a valid baseUrl for a provider that uses one', () => {
    const result = validateSettings({
      ai: { providers: { ollama: { model: 'llama3.2', baseUrl: 'http://localhost:9999' } } },
    });
    expect(result.ai.providers.ollama).toEqual({
      model: 'llama3.2',
      baseUrl: 'http://localhost:9999',
    });
  });

  it('falls back a non-string baseUrl to the provider default', () => {
    const result = validateSettings({
      ai: { providers: { ollama: { model: 'llama3.2', baseUrl: 42 } } },
    });
    expect(result.ai.providers.ollama.baseUrl).toBe(DEFAULT_SETTINGS.ai.providers.ollama.baseUrl);
  });

  it('does not invent a baseUrl for a provider whose default has none', () => {
    const result = validateSettings({ ai: { providers: { anthropic: { model: 'x' } } } });
    expect(result.ai.providers.anthropic).toEqual({ model: 'x' });
    expect(result.ai.providers.anthropic).not.toHaveProperty('baseUrl');
  });

  it('falls back the whole providers map when it is not an object', () => {
    const result = validateSettings({ ai: { providers: 'nope' } });
    expect(result.ai.providers).toEqual(DEFAULT_SETTINGS.ai.providers);
  });
});
