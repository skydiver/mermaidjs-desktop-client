import { describe, expect, it } from 'vitest';
import { isModalGated, resolveShortcut } from '../../src/lib/keyboard-shortcuts';

/** Builds the subset of a KeyboardEvent the resolver reads. */
function event(partial: Partial<Parameters<typeof resolveShortcut>[0]>) {
  return {
    key: '',
    code: '',
    shiftKey: false,
    metaKey: true,
    ctrlKey: false,
    ...partial,
  };
}

describe('resolveShortcut', () => {
  it('resolves the file shortcuts from the key', () => {
    expect(resolveShortcut(event({ key: 'n', code: 'KeyN' }))).toBe('new');
    expect(resolveShortcut(event({ key: 'o', code: 'KeyO' }))).toBe('open');
    expect(resolveShortcut(event({ key: 's', code: 'KeyS' }))).toBe('save');
  });

  it('resolves the AI panel toggle from a shifted A', () => {
    expect(resolveShortcut(event({ key: 'A', code: 'KeyA', shiftKey: true }))).toBe('toggle-ai');
  });

  // Measured in the app: with a layout where ⌘⇧A begins an accent
  // composition, WebKit reports `key: 'Dead'` and the shortcut never fired.
  // `code` is the physical key and is unaffected by composition, the layout,
  // or the modifiers held.
  it('resolves the AI panel toggle when the layout reports a dead key', () => {
    expect(resolveShortcut(event({ key: 'Dead', code: 'KeyA', shiftKey: true }))).toBe('toggle-ai');
  });

  it('resolves the file shortcuts from the code when the key is unusable', () => {
    expect(resolveShortcut(event({ key: 'Dead', code: 'KeyN' }))).toBe('new');
    expect(resolveShortcut(event({ key: 'Dead', code: 'KeyO' }))).toBe('open');
    expect(resolveShortcut(event({ key: 'Dead', code: 'KeyS' }))).toBe('save');
  });

  it('resolves settings and help, by key or by code', () => {
    expect(resolveShortcut(event({ key: ',', code: 'Comma' }))).toBe('settings');
    expect(resolveShortcut(event({ key: 'Dead', code: 'Comma' }))).toBe('settings');
    expect(resolveShortcut(event({ key: '?', code: 'Slash', shiftKey: true }))).toBe('help');
    expect(resolveShortcut(event({ key: 'Dead', code: 'Slash', shiftKey: true }))).toBe('help');
  });

  it('ignores keys with no modifier', () => {
    expect(resolveShortcut(event({ key: 'n', code: 'KeyN', metaKey: false }))).toBeNull();
  });

  it('accepts Ctrl as the modifier', () => {
    expect(resolveShortcut(event({ key: 'n', code: 'KeyN', metaKey: false, ctrlKey: true }))).toBe(
      'new'
    );
  });

  // ⌘A is the native Select All and ⌘⇧S is unbound — claiming either would
  // take a key the user expects to do something else, or nothing at all.
  it('leaves ⌘A and the shifted file shortcuts alone', () => {
    expect(resolveShortcut(event({ key: 'a', code: 'KeyA' }))).toBeNull();
    expect(resolveShortcut(event({ key: 'S', code: 'KeyS', shiftKey: true }))).toBeNull();
  });

  it('returns null for an unbound key', () => {
    expect(resolveShortcut(event({ key: 'k', code: 'KeyK' }))).toBeNull();
  });
});

describe('isModalGated', () => {
  it('gates the shortcuts that mutate the document or the workspace', () => {
    expect(isModalGated('new')).toBe(true);
    expect(isModalGated('open')).toBe(true);
    expect(isModalGated('save')).toBe(true);
    expect(isModalGated('toggle-ai')).toBe(true);
  });

  it('leaves the dialog shortcuts usable while a modal is open', () => {
    expect(isModalGated('settings')).toBe(false);
    expect(isModalGated('help')).toBe(false);
  });
});
