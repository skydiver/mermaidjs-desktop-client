import { save as showSaveDialog } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import type { EditorView } from 'codemirror';

interface SaveDiagramOptions {
  editor: EditorView;
  button: HTMLButtonElement | null;
  getPath: () => string | null;
  onPathChange: (path: string | null) => void;
  onSave?: (doc: string, path: string) => void;
}

export function setupSaveDiagramAction(options: SaveDiagramOptions): void {
  const { editor, button, getPath, onPathChange, onSave } = options;
  if (!button) return;

  button.addEventListener('click', async () => {
    const documentContent = editor.state.doc.toString();
    let targetPath = getPath();

    try {
      if (!targetPath) {
        const picked = await showSaveDialog({
          defaultPath: 'diagram.mmd',
          filters: [
            {
              name: 'Mermaid Diagram',
              extensions: ['mmd', 'mermaid', 'md'],
            },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (typeof picked === 'string') {
          targetPath = picked;
        } else {
          return;
        }
      }

      await writeTextFile(targetPath, documentContent);
      onPathChange(targetPath);
      onSave?.(documentContent, targetPath);
    } catch (error) {
      console.error('Failed to save diagram', error);
    }
  });
}
