import { open as showOpenDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import type { EditorView } from 'codemirror';

interface OpenDiagramOptions {
  editor: EditorView;
  schedulePreviewRender: (doc: string) => void;
  button: HTMLButtonElement | null;
  onPathChange: (path: string | null) => void;
  onOpen?: (doc: string, path: string) => void;
  shouldReplace?: () => boolean | Promise<boolean>;
}

export function setupOpenDiagramAction(options: OpenDiagramOptions): void {
  const { editor, schedulePreviewRender, button, onPathChange, onOpen, shouldReplace } = options;
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

      if (typeof shouldReplace === 'function') {
        const allow = await Promise.resolve(shouldReplace());
        if (!allow) {
          return;
        }
      }

      const fileContents = await readTextFile(path);
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: fileContents },
      });
      schedulePreviewRender(fileContents);
      onPathChange(path);
      onOpen?.(fileContents, path);
    } catch (error) {
      console.error('Failed to open diagram', error);
    }
  });
}
