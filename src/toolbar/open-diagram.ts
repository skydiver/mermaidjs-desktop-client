import { open as showOpenDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import type { EditorView } from 'codemirror';

interface OpenDiagramOptions {
  editor: EditorView;
  schedulePreviewRender: (doc: string) => void;
  button: HTMLButtonElement | null;
  onPathChange: (path: string | null) => void;
}

export function setupOpenDiagramAction(options: OpenDiagramOptions): void {
  const { editor, schedulePreviewRender, button, onPathChange } = options;
  if (!button) return;

  button.addEventListener('click', async () => {
    try {
      const selected = await showOpenDialog({
        filters: [
          {
            name: 'Mermaid Diagram',
            extensions: ['mmd', 'mermaid', 'md'],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!selected) return;

      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return;

      const fileContents = await readTextFile(path);
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: fileContents },
      });
      schedulePreviewRender(fileContents);
      onPathChange(path);
    } catch (error) {
      console.error('Failed to open diagram', error);
    }
  });
}
