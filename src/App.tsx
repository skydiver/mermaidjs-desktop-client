import { useCallback, useEffect, useRef, useState } from 'react';
import ContentView from './components/ContentView';
import type { EditorViewHandle } from './components/EditorView';
import SettingsDialog from './components/SettingsDialog';

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

  const handleEditorChange = useCallback((text: string) => {
    setEditorText(text);
  }, []);

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
        fileName={null}
        isDirty={false}
        lastSavedAt={null}
        statusMessage="Ready"
        statusLevel="idle"
        hasContent={editorText.trim().length > 0}
        onNewFile={() => {
          /* Task 10 */
        }}
        onOpenFile={() => {
          /* Task 10 */
        }}
        onSaveFile={() => {
          /* Task 10 */
        }}
        onOpenExamples={() => {
          /* Task 11 */
        }}
        onOpenExport={() => {
          /* Task 11 */
        }}
        onOpenHelp={() => {
          /* Task 15 */
        }}
        onOpenSettings={() => setShowSettings(true)}
      />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
}
