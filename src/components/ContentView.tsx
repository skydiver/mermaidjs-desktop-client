import { type Ref } from 'react';
import type { MermaidStatus } from '../hooks/useMermaid';
import type { ExportFormat } from '../lib/export/export-diagram';
import type { EditorViewHandle } from './EditorView';
import EditorView from './EditorView';
import PreviewView from './PreviewView';
import type { StatusLevel } from './StatusBar';
import StatusBar from './StatusBar';
import Toolbar from './Toolbar';

interface ContentViewProps {
  editorRef: Ref<EditorViewHandle>;
  editorText: string;
  onEditorChange: (text: string) => void;
  fileName: string | null;
  isDirty: boolean;
  lastSavedAt: Date | null;
  statusMessage: string;
  statusLevel: StatusLevel;
  hasContent: boolean;
  previewSource: string;
  onPreviewStatusChange: (status: MermaidStatus) => void;
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSelectExample: (content: string) => void;
  onExport: (format: ExportFormat) => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

export default function ContentView({
  editorRef,
  editorText,
  onEditorChange,
  fileName,
  isDirty,
  lastSavedAt,
  statusMessage,
  statusLevel,
  hasContent,
  previewSource,
  onPreviewStatusChange,
  onNewFile,
  onOpenFile,
  onSaveFile,
  onSelectExample,
  onExport,
  onOpenHelp,
  onOpenSettings,
}: ContentViewProps) {
  return (
    <div className="flex h-screen w-full flex-col bg-white dark:bg-neutral-900">
      <Toolbar
        onNewFile={onNewFile}
        onOpenFile={onOpenFile}
        onSaveFile={onSaveFile}
        onSelectExample={onSelectExample}
        onExport={onExport}
        onOpenHelp={onOpenHelp}
        onOpenSettings={onOpenSettings}
        isDirty={isDirty}
        hasContent={hasContent}
      />

      {/* Workspace: Editor + Preview */}
      <div className="flex min-h-0 flex-1">
        {/* Editor panel */}
        <div className="flex w-1/2 flex-col border-r border-neutral-200 dark:border-neutral-700">
          <EditorView ref={editorRef} initialText={editorText} onChange={onEditorChange} />
        </div>

        {/* Divider — will be interactive in Task 12 */}

        {/* Preview panel */}
        <div className="flex w-1/2 flex-col">
          <PreviewView source={previewSource} onStatusChange={onPreviewStatusChange} />
        </div>
      </div>

      <StatusBar
        fileName={fileName}
        isDirty={isDirty}
        lastSavedAt={lastSavedAt}
        statusMessage={statusMessage}
        statusLevel={statusLevel}
      />
    </div>
  );
}
