import { ask, open as showOpenDialog, save as showSaveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { type RefObject, useCallback, useRef, useState } from 'react';
import type { EditorViewHandle } from '../components/EditorView';
import { type ExportFormat, exportDiagram, inferBaseName } from '../lib/export/export-diagram';

// ── Types ───────────────────────────────────────────────

interface UseFileHandlingOptions {
  editorRef: RefObject<EditorViewHandle | null>;
  defaultSnippet: string;
}

export interface UseFileHandlingReturn {
  filePath: string | null;
  fileName: string | null;
  isDirty: boolean;
  lastSavedAt: Date | null;
  markDirty: () => void;
  newFile: () => Promise<void>;
  openFile: () => Promise<void>;
  openFilePath: (path: string) => Promise<void>;
  saveFile: () => Promise<void>;
  exportFile: (format: ExportFormat) => Promise<void>;
  loadExample: (content: string) => Promise<void>;
}

// ── Constants ───────────────────────────────────────────

const DIALOG_FILTERS = [
  { name: 'Mermaid Diagram', extensions: ['mmd', 'mermaid', 'md'] },
  { name: 'All Files', extensions: ['*'] },
];

// ── Hook ────────────────────────────────────────────────

export function useFileHandling({
  editorRef,
  defaultSnippet,
}: UseFileHandlingOptions): UseFileHandlingReturn {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

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
      editorRef.current?.replaceContent(content);
      isDirtyRef.current = false;
      setIsDirty(false);
    },
    [editorRef]
  );

  const newFile = useCallback(async () => {
    if (isDirtyRef.current) {
      const proceed = await confirmDiscard('Overwrite the current diagram with a blank template?');
      if (!proceed) return;
    }
    replaceContent(defaultSnippet);
    setFilePath(null);
    setLastSavedAt(null);
  }, [replaceContent, defaultSnippet]);

  const openFilePath = useCallback(
    async (path: string) => {
      try {
        const content = await readTextFile(path);
        replaceContent(content);
        setFilePath(path);
        setLastSavedAt(null);
      } catch (error) {
        console.error('Failed to open file', error);
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
      console.error('Failed to open diagram', error);
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
      console.error('Failed to save diagram', error);
    }
  }, [editorRef]);

  const exportFile = useCallback(
    async (format: ExportFormat) => {
      const editor = editorRef.current;
      if (!editor) return;
      const content = editor.getContent();
      const baseName = inferBaseName(filePathRef.current);
      await exportDiagram(content, format, baseName);
    },
    [editorRef]
  );

  const loadExample = useCallback(
    async (content: string) => {
      if (isDirtyRef.current) {
        const proceed = await confirmDiscard('Replace the current diagram with this example?');
        if (!proceed) return;
      }
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
    lastSavedAt,
    markDirty,
    newFile,
    openFile,
    openFilePath,
    saveFile,
    exportFile,
    loadExample,
  };
}

// ── Helpers ─────────────────────────────────────────────

async function confirmDiscard(message: string): Promise<boolean> {
  try {
    return await ask(message, {
      title: 'Discard unsaved changes?',
      kind: 'warning',
    });
  } catch (error) {
    console.warn('Unable to show confirmation dialog', error);
    return false;
  }
}
