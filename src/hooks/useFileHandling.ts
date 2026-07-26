import { ask, open as showOpenDialog, save as showSaveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import { type RefObject, useCallback, useRef, useState } from 'react';
import type { EditorViewHandle } from '../components/EditorView';
import { reportError, reportWarning } from '../lib/error-reporting';
import { type ExportFormat, exportDiagram, inferBaseName } from '../lib/export/export-diagram';
import { isFileTooLarge, looksBinary, MAX_OPEN_FILE_BYTES } from '../lib/file-guard';

// ── Types ───────────────────────────────────────────────

interface UseFileHandlingOptions {
  editorRef: RefObject<EditorViewHandle | null>;
  onContentReplace: (content: string) => void;
  /**
   * Whether the diagram's own theme (`settings.diagramTheme`, independent of
   * the app chrome theme) currently resolves to dark. Threaded through to
   * `exportDiagram` so the exported PNG background matches what the preview
   * actually shows.
   */
  isDiagramDark: boolean;
}

export interface UseFileHandlingReturn {
  filePath: string | null;
  fileName: string | null;
  isDirty: boolean;
  hasDocument: boolean;
  lastSavedAt: Date | null;
  markDirty: () => void;
  newFile: () => Promise<void>;
  openFile: () => Promise<void>;
  openFilePath: (path: string) => Promise<void>;
  saveFile: () => Promise<void>;
  exportFile: (format: ExportFormat) => Promise<void>;
  loadExample: (content: string) => Promise<void>;
  /** Replace editor content without marking dirty (for external reload) */
  reloadContent: (content: string) => void;
}

// ── Constants ───────────────────────────────────────────

// "All Files" is kept deliberately: a diagram saved with an unusual
// extension is a real, legitimate case, and dropping the filter would only
// stop that — it would not add any safety. The actual guard against opening
// something inappropriate (a huge log, a binary) is the size/content check
// in `openFilePath` below, which applies regardless of which filter was
// used to pick the file.
const DIALOG_FILTERS = [
  { name: 'Mermaid Diagram', extensions: ['mmd', 'mermaid', 'md'] },
  { name: 'All Files', extensions: ['*'] },
];

// ── Hook ────────────────────────────────────────────────

export function useFileHandling({
  editorRef,
  onContentReplace,
  isDiagramDark,
}: UseFileHandlingOptions): UseFileHandlingReturn {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasDocument, setHasDocument] = useState(false);

  // Refs for reading current state in stable callbacks
  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;
  const filePathRef = useRef<string | null>(null);
  filePathRef.current = filePath;

  // Suppress dirty flag during programmatic content replacement
  const suppressDirtyRef = useRef(false);

  const fileName = filePath ? (filePath.split(/[/\\]/).pop() ?? null) : null;

  const markDirty = useCallback(() => {
    if (suppressDirtyRef.current) {
      suppressDirtyRef.current = false;
      return;
    }
    isDirtyRef.current = true;
    setIsDirty(true);
  }, []);

  const replaceContent = useCallback(
    (content: string) => {
      suppressDirtyRef.current = true;
      onContentReplace(content);
      editorRef.current?.replaceContent(content);
      isDirtyRef.current = false;
      setIsDirty(false);
    },
    [editorRef, onContentReplace]
  );

  const newFile = useCallback(async () => {
    if (isDirtyRef.current) {
      const proceed = await confirmDiscard('Discard the current diagram and start fresh?');
      if (!proceed) return;
    }
    setHasDocument(true);
    replaceContent('');
    setFilePath(null);
    setLastSavedAt(null);
  }, [replaceContent]);

  // Shared entry point for all three ways a file gets opened: the Open
  // dialog, drag-and-drop, and file-association launches from Finder. Every
  // route funnels through here, so the size/type guard below covers all of
  // them rather than only the dialog path.
  const openFilePath = useCallback(
    async (path: string) => {
      try {
        const info = await stat(path);
        if (isFileTooLarge(info.size)) {
          await reportWarning(`Refused to open oversize file: ${path} (${info.size} bytes)`, {
            title: 'File Too Large',
            body: `"${path}" is ${formatBytes(info.size)}, which is above the ${formatBytes(MAX_OPEN_FILE_BYTES)} limit for diagram source. Choose a smaller file.`,
          });
          return;
        }

        const content = await readTextFile(path);
        if (looksBinary(content)) {
          await reportWarning(`Refused to open file that looks binary: ${path}`, {
            title: 'File Does Not Look Like Text',
            body: `"${path}" does not look like a text-based diagram file and was not opened.`,
          });
          return;
        }

        replaceContent(content);
        setHasDocument(true);
        setFilePath(path);
        setLastSavedAt(null);
      } catch (error) {
        await reportError('Failed to open file', error, {
          title: 'Unable to Open File',
          body: `Could not open "${path}".`,
        });
      }
    },
    [replaceContent]
  );

  const openFile = useCallback(async () => {
    try {
      const selected = await showOpenDialog({ filters: DIALOG_FILTERS });
      if (!selected) return;

      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return;

      if (isDirtyRef.current) {
        const proceed = await confirmDiscard('Replace the current diagram with the selected file?');
        if (!proceed) return;
      }

      await openFilePath(path);
    } catch (error) {
      await reportError('Failed to open diagram', error, {
        title: 'Unable to Open File',
        body: 'Could not open the selected file.',
      });
    }
  }, [openFilePath]);

  const saveFile = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    const content = editor.getContent();
    let targetPath = filePathRef.current;

    try {
      if (!targetPath) {
        const picked = await showSaveDialog({
          defaultPath: 'diagram.mmd',
          filters: DIALOG_FILTERS,
        });
        if (typeof picked === 'string') {
          targetPath = picked;
        } else {
          return;
        }
      }

      await writeTextFile(targetPath, content);
      setFilePath(targetPath);
      isDirtyRef.current = false;
      setIsDirty(false);
      setLastSavedAt(new Date());
    } catch (error) {
      // isDirty correctly stays true here so the status bar keeps showing
      // "Modified" — but that alone is easy to miss, so make the failure
      // unmistakable with a dialog too.
      await reportError('Failed to save diagram', error, {
        title: 'Save Failed',
        body: targetPath
          ? `Could not save to "${targetPath}". Your changes are still in the editor — try Save As to a different location.`
          : 'Could not save the diagram. Your changes are still in the editor.',
      });
    }
  }, [editorRef]);

  const exportFile = useCallback(
    async (format: ExportFormat) => {
      const editor = editorRef.current;
      if (!editor) return;
      const content = editor.getContent();
      const baseName = inferBaseName(filePathRef.current);
      await exportDiagram(content, format, baseName, isDiagramDark);
    },
    [editorRef, isDiagramDark]
  );

  const loadExample = useCallback(
    async (content: string) => {
      if (isDirtyRef.current) {
        const proceed = await confirmDiscard('Replace the current diagram with this example?');
        if (!proceed) return;
      }
      setHasDocument(true);
      replaceContent(content);
      setFilePath(null);
      setLastSavedAt(null);
    },
    [replaceContent]
  );

  return {
    filePath,
    fileName,
    isDirty,
    hasDocument,
    lastSavedAt,
    markDirty,
    newFile,
    openFile,
    openFilePath,
    saveFile,
    exportFile,
    loadExample,
    reloadContent: replaceContent,
  };
}

// ── Helpers ─────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function confirmDiscard(message: string): Promise<boolean> {
  try {
    return await ask(message, {
      title: 'Discard unsaved changes?',
      kind: 'warning',
    });
  } catch (error) {
    await reportError('Unable to show confirmation dialog', error, {
      title: 'Action Cancelled',
      body: 'Could not show the confirmation dialog, so the action was cancelled to avoid discarding unsaved work.',
    });
    return false;
  }
}
