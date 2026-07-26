import { indentUnit, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, highlightWhitespace } from '@codemirror/view';
import type { AppSettings } from '@/hooks/useSettings';
import { createEditorTheme, editorHighlightStyle } from './theme';

export interface EditorSettingsCompartments {
  theme: Compartment;
  fontSize: Compartment;
  lineWrapping: Compartment;
  whitespace: Compartment;
  indentConfig: Compartment;
  syntaxHighlighting: Compartment;
}

export function createSettingsCompartments(): EditorSettingsCompartments {
  return {
    theme: new Compartment(),
    fontSize: new Compartment(),
    lineWrapping: new Compartment(),
    whitespace: new Compartment(),
    indentConfig: new Compartment(),
    syntaxHighlighting: new Compartment(),
  };
}

function createFontSizeTheme(size: number) {
  return EditorView.theme({
    '.cm-scroller': { fontSize: `${size}px` },
  });
}

// Defence in depth: `settings.indentSize` should already be validated by
// `validateSettings` before it reaches here, but `String.prototype.repeat`
// throws a `RangeError` for a negative or absurdly large count, and this
// module has its own trust boundary — a future caller could reconfigure
// the editor without going through the settings loader. Clamp to a sane
// range rather than trusting the input.
function safeIndentUnit(indentType: AppSettings['indentType'], indentSize: number): string {
  if (indentType === 'tab') return '\t';
  const safeSize =
    Number.isInteger(indentSize) && indentSize >= 1 && indentSize <= 16 ? indentSize : 2;
  return ' '.repeat(safeSize);
}

function indentConfigExtensions(
  indentType: AppSettings['indentType'],
  indentSize: number
): Extension[] {
  return [
    indentUnit.of(safeIndentUnit(indentType, indentSize)),
    EditorState.tabSize.of(indentSize),
  ];
}

export function createSettingsExtensions(
  compartments: EditorSettingsCompartments,
  settings: AppSettings
): Extension[] {
  return [
    compartments.theme.of(createEditorTheme(settings.editorFontFamily, settings.disableLigatures)),
    compartments.fontSize.of(createFontSizeTheme(settings.editorFontSize)),
    compartments.lineWrapping.of(settings.wordWrap ? EditorView.lineWrapping : []),
    compartments.whitespace.of(settings.showInvisibles ? highlightWhitespace() : []),
    compartments.indentConfig.of(indentConfigExtensions(settings.indentType, settings.indentSize)),
    compartments.syntaxHighlighting.of(
      settings.syntaxHighlighting ? syntaxHighlighting(editorHighlightStyle) : []
    ),
  ];
}

export function reconfigureSettings(
  view: EditorView,
  compartments: EditorSettingsCompartments,
  settings: AppSettings
): void {
  view.dispatch({
    effects: [
      compartments.theme.reconfigure(
        createEditorTheme(settings.editorFontFamily, settings.disableLigatures)
      ),
      compartments.fontSize.reconfigure(createFontSizeTheme(settings.editorFontSize)),
      compartments.lineWrapping.reconfigure(settings.wordWrap ? EditorView.lineWrapping : []),
      compartments.whitespace.reconfigure(settings.showInvisibles ? highlightWhitespace() : []),
      compartments.indentConfig.reconfigure(
        indentConfigExtensions(settings.indentType, settings.indentSize)
      ),
      compartments.syntaxHighlighting.reconfigure(
        settings.syntaxHighlighting ? syntaxHighlighting(editorHighlightStyle) : []
      ),
    ],
  });
}
