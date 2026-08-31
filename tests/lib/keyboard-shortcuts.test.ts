import { describe, expect, it } from 'vitest';
import { shouldHandleFileShortcut } from '../../src/lib/keyboard-shortcuts';

describe('shouldHandleFileShortcut', () => {
  it('allows n/o/s when no modal is open', () => {
    expect(shouldHandleFileShortcut('n', false)).toBe(true);
    expect(shouldHandleFileShortcut('o', false)).toBe(true);
    expect(shouldHandleFileShortcut('s', false)).toBe(true);
  });

  it('blocks n/o/s while a modal is open', () => {
    expect(shouldHandleFileShortcut('n', true)).toBe(false);
    expect(shouldHandleFileShortcut('o', true)).toBe(false);
    expect(shouldHandleFileShortcut('s', true)).toBe(false);
  });

  it('blocks the AI panel toggle while a modal is open', () => {
    // Uppercase because ⌘⇧A is reported by KeyboardEvent.key as 'A'.
    expect(shouldHandleFileShortcut('A', true)).toBe(false);
    expect(shouldHandleFileShortcut('A', false)).toBe(true);
  });

  it('leaves other shortcuts unaffected regardless of modal state', () => {
    expect(shouldHandleFileShortcut(',', true)).toBe(true);
    expect(shouldHandleFileShortcut('?', true)).toBe(true);
    expect(shouldHandleFileShortcut(',', false)).toBe(true);
  });
});
