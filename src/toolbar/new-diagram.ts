import type { EditorView } from 'codemirror';

interface NewDiagramOptions {
  editor: EditorView;
  schedulePreviewRender: (doc: string) => void;
  button: HTMLButtonElement | null;
  defaultSnippet: string;
  onPathChange: (path: string | null) => void;
  onNew?: (doc: string) => void;
  shouldReplace?: () => boolean | Promise<boolean>;
}

export function setupNewDiagramAction(options: NewDiagramOptions): void {
  const {
    editor,
    schedulePreviewRender,
    button,
    defaultSnippet,
    onPathChange,
    onNew,
    shouldReplace,
  } = options;
  if (!button) return;

  button.addEventListener('click', async () => {
    if (typeof shouldReplace === 'function') {
      const allow = await Promise.resolve(shouldReplace());
      if (!allow) {
        return;
      }
    }
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: defaultSnippet },
    });
    schedulePreviewRender(defaultSnippet);
    onPathChange(null);
    onNew?.(defaultSnippet);
  });
}
