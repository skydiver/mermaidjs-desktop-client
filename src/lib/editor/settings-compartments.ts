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

export function createSettingsExtensions(
  compartments: EditorSettingsCompartments,
  settings: AppSettings
): Extension[] {
  return [
    compartments.theme.of(createEditorTheme(settings.editorFontFamily, settings.disableLigatures)),
    compartments.fontSize.of(createFontSizeTheme(settings.editorFontSize)),
    compartments.lineWrapping.of(settings.wordWrap ? EditorView.lineWrapping : []),
    compartments.whitespace.of(settings.showInvisibles ? highlightWhitespace() : []),
    compartments.indentConfig.of([
      indentUnit.of(settings.indentType === 'tab' ? '\t' : ' '.repeat(settings.indentSize)),
      EditorState.tabSize.of(settings.indentSize),
    ]),
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
      compartments.indentConfig.reconfigure([
        indentUnit.of(settings.indentType === 'tab' ? '\t' : ' '.repeat(settings.indentSize)),
        EditorState.tabSize.of(settings.indentSize),
      ]),
      compartments.syntaxHighlighting.reconfigure(
        settings.syntaxHighlighting ? syntaxHighlighting(editorHighlightStyle) : []
      ),
    ],
  });
}
