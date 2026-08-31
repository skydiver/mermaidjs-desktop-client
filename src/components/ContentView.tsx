import { type Ref, useCallback, useRef, useState } from 'react';
import type { UseAIChatReturn } from '../hooks/useAIChat';
import type { MermaidStatus, RenderStatus } from '../hooks/useMermaid';
import { DEFAULT_SETTINGS, useSettings } from '../hooks/useSettings';
import type { ExportFormat } from '../lib/export/export-diagram';
import AIPanel from './AIPanel';
import type { EditorViewHandle } from './EditorView';
import EditorView from './EditorView';
import EmptyState from './EmptyState';
import PreviewView from './PreviewView';
import StatusBar from './StatusBar';
import Toolbar from './Toolbar';

// ── Constants ───────────────────────────────────────────

const DEFAULT_RATIO = 0.4;
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;
const KEYBOARD_RATIO_STEP = 0.02;

// Bounds for the AI panel. Mirrors the clamp in `validate-settings.ts` so a
// hand-edited `settings.json` and a drag can never disagree about the range.
const MIN_AI_WIDTH = 280;
const MAX_AI_WIDTH = 600;
const KEYBOARD_AI_WIDTH_STEP = 16;
/** Sourced from the settings defaults so "reset" here and a fresh install agree. */
const DEFAULT_AI_WIDTH = DEFAULT_SETTINGS.aiPanelWidth;

// ── Props ───────────────────────────────────────────────

interface ContentViewProps {
  editorRef: Ref<EditorViewHandle>;
  editorText: string;
  onEditorChange: (text: string) => void;
  fileName: string | null;
  isDirty: boolean;
  lastSavedAt: Date | null;
  statusMessage: string;
  statusLevel: RenderStatus;
  hasContent: boolean;
  hasDocument: boolean;
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
  aiChat: UseAIChatReturn;
  showAIPanel: boolean;
  onToggleAIPanel: () => void;
  onOpenAiSettings: () => void;
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
  hasDocument,
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
  aiChat,
  showAIPanel,
  onToggleAIPanel,
  onOpenAiSettings,
}: ContentViewProps) {
  const { settings, updateSettings } = useSettings();
  const [editorRatio, setEditorRatio] = useState(DEFAULT_RATIO);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startRatioRef = useRef(DEFAULT_RATIO);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLHRElement>) => {
      draggingRef.current = true;
      startXRef.current = e.clientX;
      startRatioRef.current = editorRatio;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [editorRatio]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLHRElement>) => {
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

  // AI panel width. Dragged from the divider on the panel's left edge, so a
  // rightward drag narrows it — width is measured from the container's right
  // edge rather than accumulated from a delta, which keeps the panel pinned
  // to the pointer even if a move event is dropped.
  const aiWidth = settings.aiPanelWidth;
  const aiDraggingRef = useRef(false);

  const commitAiWidth = useCallback(
    (width: number) => {
      updateSettings({ aiPanelWidth: Math.min(MAX_AI_WIDTH, Math.max(MIN_AI_WIDTH, width)) });
    },
    [updateSettings]
  );

  const handleAiPointerDown = useCallback((e: React.PointerEvent<HTMLHRElement>) => {
    aiDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handleAiPointerMove = useCallback(
    (e: React.PointerEvent<HTMLHRElement>) => {
      if (!aiDraggingRef.current || !containerRef.current) return;
      const right = containerRef.current.getBoundingClientRect().right;
      commitAiWidth(right - e.clientX);
    },
    [commitAiWidth]
  );

  const handleAiPointerUp = useCallback(() => {
    aiDraggingRef.current = false;
  }, []);

  const handleAiDividerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLHRElement>) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          commitAiWidth(aiWidth + KEYBOARD_AI_WIDTH_STEP);
          break;
        case 'ArrowRight':
          e.preventDefault();
          commitAiWidth(aiWidth - KEYBOARD_AI_WIDTH_STEP);
          break;
        case 'Home':
          e.preventDefault();
          commitAiWidth(DEFAULT_AI_WIDTH);
          break;
        default:
          break;
      }
    },
    [aiWidth, commitAiWidth]
  );

  const handleDividerKeyDown = useCallback((e: React.KeyboardEvent<HTMLHRElement>) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setEditorRatio((prev) => Math.max(MIN_RATIO, prev - KEYBOARD_RATIO_STEP));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setEditorRatio((prev) => Math.min(MAX_RATIO, prev + KEYBOARD_RATIO_STEP));
        break;
      case 'Home':
        e.preventDefault();
        setEditorRatio(DEFAULT_RATIO);
        break;
      default:
        break;
    }
  }, []);

  return (
    <div className="flex h-screen w-full flex-col bg-white dark:bg-slate-900">
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
        aiPanelOpen={showAIPanel}
        onToggleAIPanel={onToggleAIPanel}
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

      {hasDocument ? (
        /* Workspace: Editor + Divider + Preview */
        <div ref={containerRef} className="relative flex min-h-0 flex-1">
          {/* Editor panel */}
          <div
            className="flex flex-col border-r border-neutral-200 dark:border-slate-700"
            style={{ flex: `${editorRatio} 1 0` }}
          >
            <EditorView ref={editorRef} initialText={editorText} onChange={onEditorChange} />
          </div>

          {/* Resize divider — a real <hr> carries the implicit `separator`
              accessible role, so no explicit `role` attribute is needed.
              The visual grip is a `::before` pseudo-element since <hr> is a
              void element and cannot have DOM children. */}
          <hr
            aria-label="Resize editor and preview panels"
            aria-orientation="vertical"
            aria-valuenow={Math.round(editorRatio * 100)}
            aria-valuemin={Math.round(MIN_RATIO * 100)}
            aria-valuemax={Math.round(MAX_RATIO * 100)}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleDividerKeyDown}
            className="m-0 flex w-1 shrink-0 cursor-col-resize items-center justify-center border-0 bg-transparent before:h-8 before:w-0.5 before:rounded-full before:bg-neutral-300 before:transition-colors before:content-[''] hover:bg-blue-500/20 hover:before:bg-blue-500 active:bg-blue-500/30 active:before:bg-blue-600 focus-visible:bg-blue-500/20 dark:before:bg-slate-600 dark:hover:before:bg-blue-400"
          />

          {/* Preview panel */}
          <div className="flex flex-col" style={{ flex: `${1 - editorRatio} 1 0` }}>
            <PreviewView source={editorText} onStatusChange={onPreviewStatusChange} />
          </div>

          {/* AI panel resize divider — only reachable while the panel is open,
              so it is not rendered (and not focusable) when collapsed. */}
          {showAIPanel && (
            <hr
              aria-label="Resize AI panel"
              aria-orientation="vertical"
              aria-valuenow={aiWidth}
              aria-valuemin={MIN_AI_WIDTH}
              aria-valuemax={MAX_AI_WIDTH}
              tabIndex={0}
              onPointerDown={handleAiPointerDown}
              onPointerMove={handleAiPointerMove}
              onPointerUp={handleAiPointerUp}
              onDoubleClick={() => commitAiWidth(DEFAULT_AI_WIDTH)}
              onKeyDown={handleAiDividerKeyDown}
              className="m-0 flex w-1 shrink-0 cursor-col-resize items-center justify-center border-0 bg-transparent before:h-8 before:w-0.5 before:rounded-full before:bg-neutral-300 before:transition-colors before:content-[''] hover:bg-blue-500/20 hover:before:bg-blue-500 active:bg-blue-500/30 active:before:bg-blue-600 focus-visible:bg-blue-500/20 dark:before:bg-slate-600 dark:hover:before:bg-blue-400"
            />
          )}

          {/* AI panel. The wrapper animates its width between 0 and `aiWidth`
              while the inner element stays at full width, so the panel slides
              in from the right instead of its contents reflowing on every
              frame of the transition. `motion-safe:` leaves the animation out
              for users who ask the OS to reduce motion. */}
          <div
            className="shrink-0 overflow-hidden border-l border-neutral-200 motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out dark:border-slate-700"
            style={{ width: showAIPanel ? aiWidth : 0 }}
            // Kept mounted while collapsed so the conversation survives a
            // toggle; hidden from assistive tech and tab order at width 0.
            aria-hidden={!showAIPanel}
            inert={!showAIPanel}
          >
            <div className="h-full" style={{ width: aiWidth }}>
              <AIPanel
                messages={aiChat.messages}
                isStreaming={aiChat.isStreaming}
                pendingSuggestion={aiChat.pendingSuggestion}
                error={aiChat.error}
                onSend={aiChat.send}
                onStop={aiChat.stop}
                onAcceptPending={aiChat.acceptPending}
                onCancelPending={aiChat.cancelPending}
                onClose={onToggleAIPanel}
                onOpenAiSettings={onOpenAiSettings}
              />
            </div>
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
      ) : (
        <EmptyState isDragOver={isDragOver} />
      )}

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
