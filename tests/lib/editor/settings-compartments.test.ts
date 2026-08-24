import type { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import {
  createSettingsCompartments,
  createSettingsExtensions,
  EditorSettingsCompartments,
  type EditorSettingsSubset,
  reconfigureSettings,
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

  it('keeps both paths in step when settings are toggled off', (): void => {
    const compartments: EditorSettingsCompartments = createSettingsCompartments();
    const off: EditorSettingsSubset = {
      ...SETTINGS,
      wordWrap: false,
      showInvisibles: false,
      syntaxHighlighting: false,
      indentType: 'tab',
    };
    const { view, dispatched } = recordingView();

    reconfigureSettings(view, compartments, off);

    expect(createSettingsExtensions(compartments, off)).toHaveLength(dispatched[0].effects.length);
  });
});
