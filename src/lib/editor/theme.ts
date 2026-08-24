import { HighlightStyle } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { CSS_SAFE_FONT_FAMILY_PATTERN } from '@/lib/css-safe-font';

export const editorHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  { tag: tags.operator, color: 'var(--syntax-operator)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: tags.number, color: 'var(--syntax-number)' },
  { tag: tags.bracket, color: 'var(--syntax-bracket)' },
  { tag: tags.variableName, color: 'var(--syntax-variable)' },
  { tag: tags.attributeName, color: 'var(--syntax-attribute)' },
]);

export function createEditorTheme(fontFamily?: string, disableLigatures?: boolean): Extension {
  const safeFontFamily =
    fontFamily && CSS_SAFE_FONT_FAMILY_PATTERN.test(fontFamily) ? fontFamily : undefined;
  const fontStack = safeFontFamily
    ? `"${safeFontFamily}", "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace`
    : '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace';

  return EditorView.theme({
    '&': {
      backgroundColor: 'var(--editor-bg)',
      color: 'inherit',
      minHeight: '100%',
    },
    '.cm-scroller': {
      fontFamily: fontStack,
      lineHeight: '1.5',
      fontVariantLigatures: disableLigatures ? 'none' : 'normal',
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
  });
}
