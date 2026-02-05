import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import { EditorView } from 'codemirror';

const editorHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  { tag: tags.operator, color: 'var(--syntax-operator)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: tags.number, color: 'var(--syntax-number)' },
  { tag: tags.bracket, color: 'var(--syntax-bracket)' },
  { tag: tags.variableName, color: 'var(--syntax-variable)' },
  { tag: tags.attributeName, color: 'var(--syntax-attribute)' },
]);

export function createEditorTheme(): Extension {
  return [
    EditorView.theme({
      '&': {
        borderRadius: '8px',
        border: '1px solid var(--editor-border)',
        backgroundColor: 'var(--editor-bg)',
        color: 'inherit',
        boxShadow: 'inset 0 1px 3px rgba(15, 23, 42, 0.08)',
        minHeight: '100%',
      },
      '.cm-scroller': {
        fontFamily:
          '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace',
        lineHeight: '1.5',
      },
      '.cm-content': {
        caretColor: 'var(--editor-caret)',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        border: 'none',
        color: 'var(--editor-gutter)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--editor-active-gutter, var(--editor-active-line))',
      },
    }),
    syntaxHighlighting(editorHighlightStyle),
  ];
}
