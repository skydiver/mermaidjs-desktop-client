import { type Ref, useCallback, useRef, useState } from 'react';
import type { MermaidStatus } from '../hooks/useMermaid';
import type { ExportFormat } from '../lib/export/export-diagram';
import type { EditorViewHandle } from './EditorView';
import EditorView from './EditorView';
import PreviewView from './PreviewView';
import type { StatusLevel } from './StatusBar';
import StatusBar from './StatusBar';
import Toolbar from './Toolbar';

// ── Constants ───────────────────────────────────────────

const DEFAULT_RATIO = 0.5;
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

// ── Props ───────────────────────────────────────────────

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
  isDragOver?: boolean;
  externallyModified?: boolean;
  onReloadFromDisk?: () => void;
  onKeepChanges?: () => void;
  toolbarDisabled?: boolean;
}

// ── Component ───────────────────────────────────────────

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
  isDragOver = false,
  externallyModified = false,
  onReloadFromDisk,
  onKeepChanges,
  toolbarDisabled = false,
}: ContentViewProps) {
  const [editorRatio, setEditorRatio] = useState(DEFAULT_RATIO);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startRatioRef = useRef(DEFAULT_RATIO);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      startXRef.current = e.clientX;
      startRatioRef.current = editorRatio;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [editorRatio]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !containerRef.current) return;
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    const delta = e.clientX - startXRef.current;
    const newRatio = startRatioRef.current + delta / containerWidth;
    setEditorRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, newRatio)));
  }, []);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const handleDoubleClick = useCallback(() => {
    setEditorRatio(DEFAULT_RATIO);
  }, []);

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
        disabled={toolbarDisabled}
      />

      {/* External modification warning */}
      {externallyModified && (
        <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-sm dark:border-amber-700 dark:bg-amber-950/50">
          <span className="text-amber-800 dark:text-amber-200">File was modified externally.</span>
          <button
            type="button"
            onClick={onReloadFromDisk}
            className="rounded px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200 dark:text-amber-100 dark:hover:bg-amber-800"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={onKeepChanges}
            className="rounded px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200 dark:text-amber-100 dark:hover:bg-amber-800"
          >
            Keep Changes
          </button>
        </div>
      )}

      {/* Workspace: Editor + Divider + Preview */}
      <div ref={containerRef} className="relative flex min-h-0 flex-1">
        {/* Editor panel */}
        <div
          className="flex flex-col border-r border-neutral-200 dark:border-neutral-700"
          style={{ flex: `${editorRatio} 1 0` }}
        >
          <EditorView ref={editorRef} initialText={editorText} onChange={onEditorChange} />
        </div>

        {/* Resize divider */}
        <div
          className="group flex w-1 shrink-0 cursor-col-resize items-center justify-center hover:bg-blue-500/20 active:bg-blue-500/30"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
        >
          <div className="h-8 w-0.5 rounded-full bg-neutral-300 transition-colors group-hover:bg-blue-500 group-active:bg-blue-600 dark:bg-neutral-600 dark:group-hover:bg-blue-400" />
        </div>

        {/* Preview panel */}
        <div className="flex flex-col" style={{ flex: `${1 - editorRatio} 1 0` }}>
          <PreviewView source={previewSource} onStatusChange={onPreviewStatusChange} />
        </div>

        {/* Drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-blue-100/90 dark:bg-blue-950/80">
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-blue-400 px-10 py-8 dark:border-blue-500">
              <span className="text-3xl">📄</span>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Drop Mermaid file to open
              </p>
            </div>
          </div>
        )}
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
