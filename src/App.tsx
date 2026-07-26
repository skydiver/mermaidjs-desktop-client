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
import { shouldHandleFileShortcut } from './lib/keyboard-shortcuts';

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

  // Auto-save: debounced save when enabled, file has a path, and content is dirty
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (!settings.autoSave || !fileHandling.filePath || !fileHandling.isDirty) return;

    autoSaveTimerRef.current = setTimeout(() => {
      fileHandling.saveFile();
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [settings.autoSave, fileHandling.filePath, fileHandling.isDirty, fileHandling.saveFile]);

  const handleEditorChange = useCallback(
    (text: string) => {
      setEditorText(text);
      fileHandling.markDirty();
    },
    [fileHandling.markDirty]
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
  }, [fileHandling, showSettings, showHelp]);

  // Menu events from native menu (Rust → JS)
  useEffect(() => {
    const onMenuSettings = () => {
      setShowHelp(false);
      setSettingsSection('general');
      setShowSettings(true);
    };
    const onMenuAbout = () => {
      setShowHelp(false);
      setSettingsSection('about');
      setShowSettings(true);
    };

    window.addEventListener('menu-settings', onMenuSettings);
    window.addEventListener('menu-about', onMenuAbout);
    return () => {
      window.removeEventListener('menu-settings', onMenuSettings);
      window.removeEventListener('menu-about', onMenuAbout);
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
