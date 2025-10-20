import type { Extension } from '@codemirror/state';
import { EditorView } from 'codemirror';

export function createEditorTheme(): Extension {
  return EditorView.theme({
    '&': {
      borderRadius: '8px',
      border: '1px solid var(--editor-border)',
      backgroundColor: 'var(--editor-bg)',
      color: 'inherit',
      boxShadow: 'inset 0 1px 3px rgba(15, 23, 42, 0.08)',
      minHeight: '100%',
    },
    '.cm-scroller': {
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace',
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
  });
}
