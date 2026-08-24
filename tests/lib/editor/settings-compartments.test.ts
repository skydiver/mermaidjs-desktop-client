import { indentUnit } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import {
  createSettingsCompartments,
  createSettingsExtensions,
  type EditorSettingsCompartments,
  type EditorSettingsSubset,
  reconfigureSettings,
  safeIndentUnit,
} from '@/lib/editor/settings-compartments.ts';

const SETTINGS: EditorSettingsSubset = {
  editorFontFamily: '',
  editorFontSize: 14,
  disableLigatures: false,
  wordWrap: true,
  showInvisibles: false,
  indentType: 'space',
  indentSize: 2,
  syntaxHighlighting: true,
};

// 'reconfigureSettings' only ever calls 'view.dispatch', so a recorder stands in for a real EditorView - which would
// need a DOM the node test env lacks.
function recordingView(): { view: EditorView; dispatched: { effects: unknown[] }[] } {
  const dispatched: { effects: unknown[] }[] = [];
  const view = { dispatch: (tr: { effects: unknown[] }): number => dispatched.push(tr) };
  return { view: view as unknown as EditorView, dispatched };
}

describe('settings compartments', (): void => {
  it('configures every compartment on creation', (): void => {
    const compartments: EditorSettingsCompartments = createSettingsCompartments();
    const count: number = Object.keys(compartments).length;
    expect(createSettingsExtensions(compartments, SETTINGS)).toHaveLength(count);
  });

  it('reconfigures every compartment on change', (): void => {
    const compartments: EditorSettingsCompartments = createSettingsCompartments();
    const { view, dispatched } = recordingView();

    reconfigureSettings(view, compartments, SETTINGS);

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].effects).toHaveLength(Object.keys(compartments).length);
  });

  // The two parity assertions above are the ones that can fail: both compare against the compartment
  // record, so a compartment added there but not wired into `settingsPairs` breaks them. Asserting the
  // two paths against *each other* cannot fail - they derive from the same list - so this covers
  // `safeIndentUnit` instead, which maps settings to an actual indent string and had no coverage.
  it('resolves the indent unit from the indent settings', (): void => {
    const compartments: EditorSettingsCompartments = createSettingsCompartments();
    const unitFor = (overrides: Partial<EditorSettingsSubset>): string =>
      EditorState.create({
        extensions: createSettingsExtensions(compartments, { ...SETTINGS, ...overrides }),
      }).facet(indentUnit);

    expect(unitFor({ indentType: 'space', indentSize: 2 })).toBe('  ');
    expect(unitFor({ indentType: 'space', indentSize: 4 })).toBe('    ');
    expect(unitFor({ indentType: 'space', indentSize: 8 })).toBe('        ');
    expect(unitFor({ indentType: 'tab' })).toBe('\t');
  });

  it('carries the indent size through to the tab size', (): void => {
    const compartments: EditorSettingsCompartments = createSettingsCompartments();
    const state = EditorState.create({
      extensions: createSettingsExtensions(compartments, { ...SETTINGS, indentSize: 8 }),
    });

    expect(state.tabSize).toBe(8);
  });

  // `safeIndentUnit` is tested directly because the clamp only fires on values outside
  // `AppSettings['indentSize']`, which `createSettingsExtensions` will not accept.
  it('clamps an out-of-range indent size instead of throwing', (): void => {
    expect(safeIndentUnit('space', -1)).toBe('  ');
    expect(safeIndentUnit('space', 0)).toBe('  ');
    expect(safeIndentUnit('space', 2.5)).toBe('  ');
    expect(safeIndentUnit('space', Number.NaN)).toBe('  ');
    expect(safeIndentUnit('space', 1e9)).toBe('  ');
    expect(safeIndentUnit('space', 16)).toBe(' '.repeat(16));
  });

  it('ignores the indent size entirely for tabs', (): void => {
    expect(safeIndentUnit('tab', -1)).toBe('\t');
  });
});
