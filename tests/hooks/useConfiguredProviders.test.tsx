// @vitest-environment jsdom
import { act, render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfiguredProviders } from '../../src/hooks/useConfiguredProviders';
import { type AppSettings, DEFAULT_SETTINGS, SettingsContext } from '../../src/hooks/useSettings';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }));

/**
 * Renders the hook against a settings context that applies updates for real,
 * so the reconciliation effect settles instead of re-firing forever. Holding
 * settings in component state (rather than a closure variable plus a manual
 * rerender) is what makes the update actually propagate to the hook.
 */
function renderHook(initial: AppSettings) {
  const updateSettings = vi.fn();
  let latest: ReturnType<typeof useConfiguredProviders> | null = null;

  function Probe() {
    latest = useConfiguredProviders();
    return null;
  }

  function Harness() {
    const [settings, setSettings] = useState(initial);
    return (
      <SettingsContext.Provider
        value={{
          settings,
          isDiagramDark: false,
          updateSettings: (patch) => {
            updateSettings(patch);
            setSettings((prev) => ({ ...prev, ...patch }));
          },
          resetSettings: vi.fn(),
        }}
      >
        <Probe />
      </SettingsContext.Provider>
    );
  }

  render(<Harness />);

  return {
    get result() {
      return latest;
    },
    updateSettings,
  };
}

function settingsWith(patch: Partial<AppSettings['ai']>): AppSettings {
  return { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, ...patch } };
}

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue([
    { provider: 'anthropic', hasApiKey: false },
    { provider: 'openai', hasApiKey: false },
    { provider: 'ollama', hasApiKey: false },
    { provider: 'openai-compatible', hasApiKey: false },
  ]);
});

describe('useConfiguredProviders', () => {
  it('reports a configured Ollama even though no provider is active yet', async () => {
    const { result } = renderHook(
      settingsWith({
        activeProvider: null,
        providers: {
          ...DEFAULT_SETTINGS.ai.providers,
          ollama: { model: 'gemma4:12b', baseUrl: 'http://localhost:11434' },
        },
      })
    );

    await waitFor(() => {
      expect(result?.configured.map((meta) => meta.id)).toEqual(['ollama']);
    });
  });

  // The bug this hook exists to prevent: the panel gated itself on
  // `activeProvider`, which only the picker could set, and the picker only
  // rendered once it was already set — so configuring a provider left the
  // panel permanently stuck on its empty state.
  it('selects the first configured provider when none is active', async () => {
    const { updateSettings } = renderHook(
      settingsWith({
        activeProvider: null,
        providers: {
          ...DEFAULT_SETTINGS.ai.providers,
          ollama: { model: 'gemma4:12b', baseUrl: 'http://localhost:11434' },
        },
      })
    );

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ ai: expect.objectContaining({ activeProvider: 'ollama' }) })
      );
    });
  });

  it('reports nothing configured when no provider has a model', async () => {
    const { result, updateSettings } = renderHook(settingsWith({ activeProvider: null }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result?.configured).toEqual([]);
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
