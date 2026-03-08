import { useCallback, useEffect, useRef, useState } from 'react';
import ContentView from './components/ContentView';
import type { EditorViewHandle } from './components/EditorView';
import SettingsDialog from './components/SettingsDialog';
import type { StatusLevel } from './components/StatusBar';
import { useFileHandling } from './hooks/useFileHandling';
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
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [statusLevel, setStatusLevel] = useState<StatusLevel>('idle');

  const fileHandling = useFileHandling({
    editorRef,
    defaultSnippet: DEFAULT_SNIPPET,
  });

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
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fileHandling]);

  // Menu events from native menu (Rust → JS)
  useEffect(() => {
    const onMenuSettings = () => setShowSettings(true);

    window.addEventListener('menu-settings', onMenuSettings);
    return () => {
      window.removeEventListener('menu-settings', onMenuSettings);
    };
  }, []);

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
        onOpenHelp={() => {
          /* Task 15 */
        }}
        onOpenSettings={() => setShowSettings(true)}
      />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
}
