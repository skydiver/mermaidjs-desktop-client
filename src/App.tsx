import { useCallback, useEffect, useRef, useState } from 'react';
import ContentView from './components/ContentView';
import type { EditorViewHandle } from './components/EditorView';
import HelpDialog from './components/HelpDialog';
import SettingsDialog, { type SectionId } from './components/SettingsDialog';
import type { StatusLevel } from './components/StatusBar';
import { useFileHandling } from './hooks/useFileHandling';
import { useFileWatch } from './hooks/useFileWatch';
import type { MermaidStatus } from './hooks/useMermaid';

const DEFAULT_SNIPPET = `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Result 1]
    B -->|No| D[Result 2]
    C --> E[End]
    D --> E
`;

export default function App() {
  const editorRef = useRef<EditorViewHandle>(null);
  const [editorText, setEditorText] = useState(DEFAULT_SNIPPET);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SectionId>('general');
  const [showHelp, setShowHelp] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [statusLevel, setStatusLevel] = useState<StatusLevel>('idle');

  const fileHandling = useFileHandling({
    editorRef,
    defaultSnippet: DEFAULT_SNIPPET,
  });

  const fileWatch = useFileWatch(
    fileHandling.filePath,
    editorText,
    fileHandling.isDirty,
    fileHandling.reloadContent
  );

  const handleEditorChange = useCallback(
    (text: string) => {
      setEditorText(text);
      fileHandling.markDirty();
    },
    [fileHandling.markDirty]
  );

  const handlePreviewStatusChange = useCallback((status: MermaidStatus) => {
    setStatusMessage(status.message);
    setStatusLevel(status.level);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      if (!(e.metaKey || e.ctrlKey)) return;
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
          setSettingsSection('general');
          setShowSettings(true);
          break;
        case '?':
          e.preventDefault();
          setShowHelp(true);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fileHandling]);

  // Menu events from native menu (Rust → JS)
  useEffect(() => {
    const onMenuSettings = () => {
      setSettingsSection('general');
      setShowSettings(true);
    };
    const onMenuAbout = () => {
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
    let unlisten: (() => void) | undefined;
    async function setup() {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        unlisten = await getCurrentWebviewWindow().onDragDropEvent((event) => {
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
      }
    }
    setup();
    return () => {
      unlisten?.();
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
        statusMessage={statusMessage}
        statusLevel={statusLevel}
        hasContent={editorText.trim().length > 0}
        previewSource={editorText}
        onPreviewStatusChange={handlePreviewStatusChange}
        onNewFile={fileHandling.newFile}
        onOpenFile={fileHandling.openFile}
        onSaveFile={fileHandling.saveFile}
        onSelectExample={fileHandling.loadExample}
        onExport={fileHandling.exportFile}
        onOpenHelp={() => setShowHelp(true)}
        onOpenSettings={() => {
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
