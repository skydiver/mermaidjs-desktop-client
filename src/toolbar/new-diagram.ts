import type { EditorView } from 'codemirror';

interface NewDiagramOptions {
  editor: EditorView;
  schedulePreviewRender: (doc: string) => void;
  button: HTMLButtonElement | null;
  defaultSnippet: string;
  onPathChange: (path: string | null) => void;
}

export function setupNewDiagramAction(options: NewDiagramOptions): void {
  const { editor, schedulePreviewRender, button, defaultSnippet, onPathChange } = options;
  if (!button) return;

  button.addEventListener('click', () => {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: defaultSnippet },
    });
    schedulePreviewRender(defaultSnippet);
    onPathChange(null);
  });
}
