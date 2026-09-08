import { describe, expect, it } from 'vitest';
import { isProviderConfigured } from '../../../src/lib/ai/provider-configured';

describe('isProviderConfigured', () => {
  it('is false when there is no config at all', () => {
    expect(isProviderConfigured('anthropic', undefined, true)).toBe(false);
  });

  it('is false when the model is empty, even with a key present', () => {
    expect(isProviderConfigured('anthropic', { model: '' }, true)).toBe(false);
  });

  it('is false when the model is only whitespace', () => {
    expect(isProviderConfigured('anthropic', { model: '   ' }, true)).toBe(false);
  });

  it('is true for a keyed provider with a model and a keychain key', () => {
    expect(isProviderConfigured('anthropic', { model: 'claude-sonnet-4-5' }, true)).toBe(true);
  });

  it('is false for a keyed provider with a model but no keychain key', () => {
    expect(isProviderConfigured('openai', { model: 'gpt-4o' }, false)).toBe(false);
  });

  it('is true for Ollama with a model and a base URL, even without a keychain key', () => {
    expect(
      isProviderConfigured(
        'ollama',
        { model: 'llama3.2', baseUrl: 'http://localhost:11434' },
        false
      )
    ).toBe(true);
  });

  it('is false for Ollama with a model but no base URL', () => {
    expect(isProviderConfigured('ollama', { model: 'llama3.2', baseUrl: '' }, false)).toBe(false);
  });

  it('is false for Ollama with only whitespace in the base URL', () => {
    expect(isProviderConfigured('ollama', { model: 'llama3.2', baseUrl: '   ' }, false)).toBe(
      false
    );
  });

  it('is false for openai-compatible with a base URL but no keychain key (spec: needs a key, not a URL)', () => {
    expect(
      isProviderConfigured(
        'openai-compatible',
        { model: 'gpt-4o', baseUrl: 'https://example.com/v1' },
        false
      )
    ).toBe(false);
  });

  it('is true for openai-compatible with a model and a keychain key', () => {
    expect(
      isProviderConfigured(
        'openai-compatible',
        { model: 'gpt-4o', baseUrl: 'https://example.com/v1' },
        true
      )
    ).toBe(true);
  });
});
