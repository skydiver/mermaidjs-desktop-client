import { readTextFile } from '@tauri-apps/plugin-fs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { manageAsyncResource } from '../lib/async-resource';
import { reportError, shouldReportWatchFailure } from '../lib/error-reporting';

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

  // Tracks the path of the most recently reported background watcher
  // failure, so a watcher that keeps firing on the same broken file does not
  // spam the user with repeated identical dialogs. Reset to null once a read
  // for that path succeeds again, so a later, new failure is still reported.
  const lastReportedWatchFailurePathRef = useRef<string | null>(null);

  const keepChanges = useCallback(() => setExternallyModified(false), []);

  const reload = useCallback(async () => {
    const path = filePathRef.current;
    if (!path) return;
    try {
      const content = await readTextFile(path);
      onReloadRef.current(content);
      setExternallyModified(false);
    } catch (err) {
      // Explicit, user-initiated "Reload from disk" — always surface.
      await reportError('File watch reload failed:', err, {
        title: 'Reload Failed',
        body: `Could not reload "${path}" from disk.`,
      });
    }
  }, []);

  useEffect(() => {
    if (!filePath) return;

    setExternallyModified(false);
    let cancelled = false;
    const path = filePath;

    // `subscribe` resolves to a no-op release when the watch cannot be
    // established (outside Tauri, or the plugin import itself fails) so the
    // helper always has a real, uniformly-releasable handle to manage.
    const teardown = manageAsyncResource<() => void>(
      async () => {
        let fsModule: typeof import('@tauri-apps/plugin-fs');
        try {
          fsModule = await import('@tauri-apps/plugin-fs');
        } catch {
          // Not in Tauri environment (Vite-only dev)
          return () => {
            // No watcher was established — nothing to release.
          };
        }

        return fsModule.watch(
          path,
          async () => {
            if (cancelled) return;

            try {
              const content = await readTextFile(path);
              if (cancelled) return;

              // Read succeeded — clear any prior failure record for this path
              // so a future failure is reported again rather than suppressed.
              lastReportedWatchFailurePathRef.current = null;

              // No actual change — ignore (e.g. our own save triggered the event)
              if (content === sourceTextRef.current) return;

              if (isDirtyRef.current) {
                setExternallyModified(true);
                return;
              }

              onReloadRef.current(content);
            } catch (err) {
              // Background watcher failure with real user impact: what's on
              // screen may no longer match disk. A watcher can fire repeatedly
              // for the same broken file, so only report the first failure per
              // path until a subsequent read succeeds.
              if (shouldReportWatchFailure(path, lastReportedWatchFailurePathRef.current)) {
                lastReportedWatchFailurePathRef.current = path;
                await reportError('File watch reload failed:', err, {
                  title: 'File Changed On Disk',
                  body: `"${path}" changed on disk but could not be re-read. Further external changes to this file may not be detected until it is reopened.`,
                });
              } else {
                console.error('File watch reload failed:', err);
              }
            }
          },
          { delayMs: 1000 }
        );
      },
      (unwatch) => unwatch(),
      (err) => {
        void reportError('File watcher setup failed:', err, {
          title: 'File Watching Unavailable',
          body: `Changes to "${path}" made outside the app will not be detected automatically.`,
        });
      }
    );

    return () => {
      cancelled = true;
      teardown();
    };
  }, [filePath]);

  return { externallyModified, reload, keepChanges };
}
