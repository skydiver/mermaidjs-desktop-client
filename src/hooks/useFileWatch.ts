import { readTextFile } from '@tauri-apps/plugin-fs';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface FileWatchState {
  /** True when the file on disk changed while the editor has unsaved changes */
  externallyModified: boolean;
  /** Reload the file from disk (user accepted overwrite) */
  reload: () => void;
  /** Dismiss the warning and keep editor content */
  keepChanges: () => void;
}

/**
 * Watches the currently-open file for external modifications.
 * When the editor is clean, auto-reloads silently.
 * When dirty, sets `externallyModified` so the UI can show a warning.
 */
export function useFileWatch(
  filePath: string | null,
  sourceText: string,
  isDirty: boolean,
  onReload: (content: string) => void
): FileWatchState {
  const [externallyModified, setExternallyModified] = useState(false);

  // Refs so the watcher callback always reads fresh values
  // without causing the effect to re-run on every keystroke
  const sourceTextRef = useRef(sourceText);
  sourceTextRef.current = sourceText;

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;

  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;

  const keepChanges = useCallback(() => setExternallyModified(false), []);

  const reload = useCallback(async () => {
    const path = filePathRef.current;
    if (!path) return;
    try {
      const content = await readTextFile(path);
      onReloadRef.current(content);
      setExternallyModified(false);
    } catch (err) {
      console.error('File watch reload failed:', err);
    }
  }, []);

  useEffect(() => {
    if (!filePath) return;

    setExternallyModified(false);
    let cancelled = false;
    let unwatch: (() => void) | undefined;

    async function startWatching(path: string) {
      let fsModule: typeof import('@tauri-apps/plugin-fs');
      try {
        fsModule = await import('@tauri-apps/plugin-fs');
      } catch {
        // Not in Tauri environment (Vite-only dev)
        return;
      }

      try {
        unwatch = await fsModule.watch(
          path,
          async () => {
            if (cancelled) return;

            try {
              const content = await readTextFile(path);
              if (cancelled) return;

              // No actual change — ignore (e.g. our own save triggered the event)
              if (content === sourceTextRef.current) return;

              if (isDirtyRef.current) {
                setExternallyModified(true);
                return;
              }

              onReloadRef.current(content);
            } catch (err) {
              console.error('File watch reload failed:', err);
            }
          },
          { delayMs: 1000 }
        );
      } catch (err) {
        console.warn('File watcher setup failed:', err);
      }
    }

    startWatching(filePath);

    return () => {
      cancelled = true;
      unwatch?.();
    };
  }, [filePath]);

  return { externallyModified, reload, keepChanges };
}
