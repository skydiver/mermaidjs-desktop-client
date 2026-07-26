import { useCallback, useEffect, useRef, useState } from 'react';
import ContentView from './components/ContentView';
import type { EditorViewHandle } from './components/EditorView';
import HelpDialog from './components/HelpDialog';
import SettingsDialog, { type SectionId } from './components/SettingsDialog';
import { useFileHandling } from './hooks/useFileHandling';
import { useFileWatch } from './hooks/useFileWatch';
import type { MermaidStatus } from './hooks/useMermaid';
import { useSettings } from './hooks/useSettings';
import { manageAsyncResource } from './lib/async-resource';
import { debounce } from './lib/debounce';
import { shouldHandleFileShortcut } from './lib/keyboard-shortcuts';

const AUTO_SAVE_DEBOUNCE_MS = 1000;

export default function App() {
  const editorRef = useRef<EditorViewHandle>(null);
  const [editorText, setEditorText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SectionId>('general');
  const [showHelp, setShowHelp] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<MermaidStatus>({ message: 'Ready', level: 'idle' });

  const { settings, isDiagramDark } = useSettings();

  const fileHandling = useFileHandling({
    editorRef,
    onContentReplace: setEditorText,
    isDiagramDark,
  });

  const fileWatch = useFileWatch(
    fileHandling.filePath,
    editorText,
    fileHandling.isDirty,
    fileHandling.reloadContent
  );

  // Auto-save: writes ~1s after typing stops, when enabled and the file has
  // a path. Triggered directly from `handleEditorChange` (every keystroke)
  // rather than from a `useEffect` keyed on `isDirty` — `isDirty` only
  // flips false → true once per edit session, so an effect depending on it
  // would arm the timer once and then fire on a fixed ~1s cadence for as
  // long as typing continued, instead of debouncing against it. Debouncing
  // on the change callback itself resets the timer on every keystroke, so a
  // single write happens only once typing actually pauses.
  const saveFileRef = useRef(fileHandling.saveFile);
  saveFileRef.current = fileHandling.saveFile;

  // The document an in-flight timer was armed for, versus the document
  // currently open. A timer armed for file A must not fire once the user has
  // moved on: after ⌘N the path is `null`, and `saveFile()` with no path
  // opens a native Save dialog — an unprompted modal for a document the user
  // never asked to save. The timer is therefore gated on identity at fire
  // time rather than cancelled from an effect, since a cleanup-only
  // dependency is invisible to the exhaustive-deps analysis.
  const armedForPathRef = useRef<string | null>(null);
  const filePathRef = useRef(fileHandling.filePath);
  filePathRef.current = fileHandling.filePath;

  const debouncedAutoSaveRef = useRef<ReturnType<typeof debounce<[]>> | null>(null);
  if (!debouncedAutoSaveRef.current) {
    debouncedAutoSaveRef.current = debounce(() => {
      if (armedForPathRef.current !== filePathRef.current) return;
      saveFileRef.current();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  useEffect(() => {
    if (!settings.autoSave) debouncedAutoSaveRef.current?.cancel();
  }, [settings.autoSave]);

  useEffect(() => {
    return () => debouncedAutoSaveRef.current?.cancel();
  }, []);

  const handleEditorChange = useCallback(
    (text: string) => {
      setEditorText(text);
      fileHandling.markDirty();
      if (settings.autoSave && fileHandling.filePath) {
        armedForPathRef.current = fileHandling.filePath;
        debouncedAutoSaveRef.current?.();
      }
    },
    [fileHandling.markDirty, settings.autoSave, fileHandling.filePath]
  );

  const handlePreviewStatusChange = useCallback((s: MermaidStatus) => {
    setStatus(s);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1' && !showSettings) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      if (!(e.metaKey || e.ctrlKey)) return;
      if (!shouldHandleFileShortcut(e.key, showSettings || showHelp)) return;
      switch (e.key) {
        case 'n':
          e.preventDefault();
          fileHandling.newFile();
          break;
        case 'o':
          e.preventDefault();
          fileHandling.openFile();
          break;
        case 's':
          e.preventDefault();
          fileHandling.saveFile();
          break;
        case ',':
          e.preventDefault();
          setShowHelp(false);
          setSettingsSection('general');
          setShowSettings(true);
          break;
        case '?':
          e.preventDefault();
          setShowSettings(false);
          setShowHelp(true);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fileHandling.newFile, fileHandling.openFile, fileHandling.saveFile, showSettings, showHelp]);

  // Menu events from the native menu (Rust → JS). Delivered as Tauri events
  // rather than DOM events: the Rust side emits them instead of evaluating a
  // `dispatchEvent` source string in the webview.
  useEffect(() => {
    let cancelled = false;

    const openSettingsAt = (section: SectionId) => {
      if (cancelled) return;
      setShowHelp(false);
      setSettingsSection(section);
      setShowSettings(true);
    };

    const teardown = manageAsyncResource<() => void>(
      async () => {
        try {
          const { listen } = await import('@tauri-apps/api/event');
          // Registered together so a failure part-way through cannot leave
          // one listener attached with no way to release it.
          const unlisteners = await Promise.all([
            listen('menu-settings', () => openSettingsAt('general')),
            listen('menu-about', () => openSettingsAt('about')),
          ]);
          return () => {
            for (const unlisten of unlisteners) unlisten();
          };
        } catch {
          // Not in Tauri environment (Vite-only dev) — there is no native
          // menu to emit these, so there is nothing to listen for.
          return () => {
            // No listener was established — nothing to release.
          };
        }
      },
      (unlisten) => unlisten()
    );

    return () => {
      cancelled = true;
      teardown();
    };
  }, []);

  // Drag-and-drop (Tauri native)
  useEffect(() => {
    let cancelled = false;

    // `subscribe` resolves to a no-op release outside Tauri (Vite-only dev)
    // so the helper always has a real, uniformly-releasable handle to manage.
    const teardown = manageAsyncResource<() => void>(
      async () => {
        try {
          const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          return await getCurrentWebviewWindow().onDragDropEvent((event) => {
            // If the effect was torn down before this listener resolved
            // (StrictMode double-invoke, or a fast file switch), an orphaned
            // listener could still fire on this stale closure and double-open
            // a dropped file — guard against that explicitly.
            if (cancelled) return;

            if (event.payload.type === 'enter' || event.payload.type === 'over') {
              setIsDragOver(true);
            } else if (event.payload.type === 'drop') {
              setIsDragOver(false);
              const paths = event.payload.paths;
              const validFile = paths.find((p) => /\.(mmd|mermaid|md)$/i.test(p));
              if (validFile) {
                fileHandling.openFilePath(validFile);
              }
            } else if (event.payload.type === 'leave') {
              setIsDragOver(false);
            }
          });
        } catch {
          // Not in Tauri environment (Vite-only dev)
          return () => {
            // No listener was established — nothing to release.
          };
        }
      },
      (unlisten) => unlisten()
    );

    return () => {
      cancelled = true;
      teardown();
    };
  }, [fileHandling.openFilePath]);

  // File association launch (Rust → JS): a `.mmd`/`.mermaid` opened via
  // Finder is buffered in Rust state (`take_pending_file_open`) rather than
  // delivered by a bare `emit`, because on a cold launch `RunEvent::Opened`
  // can fire before this listener is registered and a dropped emit would
  // silently fail to load the file. `drainPendingFile` is the single point
  // of consumption for both routes — the Rust-side buffer is taken
  // atomically, so a path can never be opened twice even if the cold-start
  // drain and the `file-opened` event both fire close together.
  useEffect(() => {
    let cancelled = false;

    const drainPendingFile = async () => {
      if (cancelled) return;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        // Re-check after the await. Taking the buffer is destructive, so a
        // torn-down effect must not consume a path the live one still needs —
        // under StrictMode's double-invoke the discarded instance would
        // otherwise empty the buffer and the file would silently fail to open.
        if (cancelled) return;
        const path = await invoke<string | null>('take_pending_file_open');
        if (!cancelled && path) {
          fileHandling.openFilePath(path);
        }
      } catch {
        // Not in Tauri environment (Vite-only dev)
      }
    };

    const teardown = manageAsyncResource<() => void>(
      async () => {
        try {
          const { listen } = await import('@tauri-apps/api/event');
          const unlisten = await listen('file-opened', () => {
            if (cancelled) return;
            drainPendingFile();
          });
          // Cold-start: a file may already be buffered before this listener
          // was registered — drain it once on mount to cover that race.
          drainPendingFile();
          return unlisten;
        } catch {
          // Not in Tauri environment (Vite-only dev)
          return () => {
            // No listener was established — nothing to release.
          };
        }
      },
      (unlisten) => unlisten()
    );

    return () => {
      cancelled = true;
      teardown();
    };
  }, [fileHandling.openFilePath]);

  return (
    <>
      <ContentView
        editorRef={editorRef}
        editorText={editorText}
        onEditorChange={handleEditorChange}
        fileName={fileHandling.fileName}
        isDirty={fileHandling.isDirty}
        lastSavedAt={fileHandling.lastSavedAt}
        statusMessage={status.message}
        statusLevel={status.level}
        hasContent={editorText.trim().length > 0}
        hasDocument={fileHandling.hasDocument}
        onPreviewStatusChange={handlePreviewStatusChange}
        onNewFile={fileHandling.newFile}
        onOpenFile={fileHandling.openFile}
        onSaveFile={fileHandling.saveFile}
        onSelectExample={fileHandling.loadExample}
        onExport={fileHandling.exportFile}
        onOpenHelp={() => {
          setShowSettings(false);
          setShowHelp(true);
        }}
        onOpenSettings={() => {
          setShowHelp(false);
          setSettingsSection('general');
          setShowSettings(true);
        }}
        isDragOver={isDragOver}
        externallyModified={fileWatch.externallyModified}
        onReloadFromDisk={fileWatch.reload}
        onKeepChanges={fileWatch.keepChanges}
        toolbarDisabled={showSettings || showHelp}
      />
      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        initialSection={settingsSection}
      />
      <HelpDialog open={showHelp} onOpenChange={setShowHelp} />
    </>
  );
}
