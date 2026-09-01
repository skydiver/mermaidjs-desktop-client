import { type Ref, useCallback, useEffect, useRef, useState } from 'react';
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

// The editor holds a fixed pixel width and the preview takes whatever is left,
// so resizing the AI panel changes only the diagram area. `DEFAULT_RATIO` is
// used ONCE, to seed that pixel width from the first measurement — deriving it
// from the split on every render is what used to drag the editor along
// whenever the AI panel changed size.
const DEFAULT_RATIO = 0.4;
// Pane floors, in pixels. Bounding the editor in pixels rather than as a
// fraction of the split is the other half of the same fix: a fractional
// ceiling shrinks with the split, so widening the AI panel would still push
// the editor inward. With a pixel floor for the preview, the panel eats the
// preview alone until the preview has nothing left to give.
const MIN_EDITOR_WIDTH = 240;
const MIN_PREVIEW_WIDTH = 240;
const KEYBOARD_SPLIT_STEP = 16;

// Bounds for the AI panel. The minimum mirrors `validate-settings.ts`; the
// maximum is proportional — half the workspace — so the ceiling scales with the
// window instead of being a constant that is generous at 1200px and cramped on
// a large display. `MIN_AI_WIDTH_MAX` keeps that half from collapsing to
// something unusable at the 1200px minimum window size.
const MIN_AI_WIDTH = 280;
const MAX_AI_WIDTH_FRACTION = 0.5;
const MIN_AI_WIDTH_MAX = 600;
const KEYBOARD_AI_WIDTH_STEP = 16;
/** Sourced from the settings defaults so "reset" here and a fresh install agree. */
const DEFAULT_AI_WIDTH = DEFAULT_SETTINGS.aiPanelWidth;

/**
 * Shared by both pane dividers so they cannot drift apart.
 *
 * `h-full` is load-bearing: Tailwind's Preflight sets `hr { height: 0 }`, and
 * an explicit height stops `align-self: stretch` from stretching the element.
 * Without it the divider is a 4x0 box — only the overflowing `::before` grip
 * paints, so the hit area is a ~32px sliver at the very top and the divider
 * looks draggable while being, in practice, impossible to grab.
 */
const DIVIDER_CLASS =
  "m-0 flex h-full w-1 shrink-0 cursor-col-resize items-center justify-center border-0 bg-transparent before:h-8 before:w-0.5 before:rounded-full before:bg-neutral-300 before:transition-colors before:content-[''] hover:bg-blue-500/20 hover:before:bg-blue-500 active:bg-blue-500/30 active:before:bg-blue-600 focus-visible:bg-blue-500/20 dark:before:bg-slate-600 dark:hover:before:bg-blue-400";

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
  /**
   * Sends a chat message. Not `aiChat.send` directly: sending from the empty
   * state has to create a document first, so the editor exists to receive the
   * suggestion when the reply lands.
   */
  onAiSend: (text: string) => void;
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
  onAiSend,
  showAIPanel,
  onToggleAIPanel,
  onOpenAiSettings,
}: ContentViewProps) {
  const { settings, updateSettings } = useSettings();
  // Editor width in pixels. `null` until the split has been measured, at which
  // point it is seeded once at DEFAULT_RATIO of that width and thereafter only
  // ever changes when the user drags this divider.
  const [editorWidth, setEditorWidth] = useState<number | null>(null);
  const [splitWidth, setSplitWidth] = useState(0);
  // `containerRef` spans only the editor/preview split, so the ratio drag is
  // measured against that area alone. `rowRef` spans the split AND the AI
  // panel, giving the panel drag the true right edge of the workspace.
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);

  // Measure the split so the editor's width can be seeded and bounded. Keyed on
  // `hasDocument` because the split is unmounted in the empty state, where
  // `containerRef` is null.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `hasDocument` is not read in the body — it is the signal that `containerRef` has just been mounted or unmounted, which is exactly when the observer must be re-attached.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setSplitWidth(width);
      // Seeded from the first non-zero measurement and never again: later
      // measurements are the AI panel opening or the window resizing, and
      // neither should move the editor.
      if (width > 0) setEditorWidth((current) => current ?? width * DEFAULT_RATIO);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [hasDocument]);

  // How wide the editor may be right now: never below its own floor, and never
  // so wide that the preview drops under its floor. Clamping for display only —
  // rather than writing the smaller value back — means a squeeze from the AI
  // panel or a narrow window is undone once there is room again.
  const maxEditorWidth = Math.max(MIN_EDITOR_WIDTH, splitWidth - MIN_PREVIEW_WIDTH);
  const clampEditorWidth = (width: number) =>
    Math.min(maxEditorWidth, Math.max(MIN_EDITOR_WIDTH, width));

  const resolvedEditorWidth = splitWidth === 0 ? 0 : clampEditorWidth(editorWidth ?? 0);

  const commitEditorWidth = useCallback(
    (width: number) => {
      if (splitWidth === 0) return;
      setEditorWidth(Math.min(maxEditorWidth, Math.max(MIN_EDITOR_WIDTH, width)));
    },
    [splitWidth, maxEditorWidth]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLHRElement>) => {
    // Without this the browser begins a text selection under the pointer,
    // which then extends across the editor and preview for the whole drag.
    e.preventDefault();
    draggingRef.current = true;
    setIsResizing(true);
    startXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLHRElement>) => {
      if (!draggingRef.current || !containerRef.current) return;
      // Measured from the split's left edge rather than accumulated from a
      // delta, so a dropped move event cannot leave the pane offset from the
      // pointer for the rest of the drag.
      const left = containerRef.current.getBoundingClientRect().left;
      commitEditorWidth(e.clientX - left);
    },
    [commitEditorWidth]
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    setIsResizing(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    commitEditorWidth(splitWidth * DEFAULT_RATIO);
  }, [commitEditorWidth, splitWidth]);

  // AI panel width. Dragged from the divider on the panel's left edge, so a
  // rightward drag narrows it — width is measured from the container's right
  // edge rather than accumulated from a delta, which keeps the panel pinned
  // to the pointer even if a move event is dropped.
  const aiDraggingRef = useRef(false);
  // Drives both the suppressed width transition and the suppressed text
  // selection, so it has to be state rather than only a ref — a ref would not
  // re-render to apply the classes. Shared by both dividers: while either is
  // being dragged the workspace should neither animate nor select text.
  const [isResizing, setIsResizing] = useState(false);

  // Tracked so the proportional maximum follows a window resize. Falls back to
  // the viewport before the first measurement, which only matters for the very
  // first render.
  const [rowWidth, setRowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(([entry]) => {
      setRowWidth(entry.contentRect.width);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  const maxAiWidth = Math.max(MIN_AI_WIDTH_MAX, Math.round(rowWidth * MAX_AI_WIDTH_FRACTION));
  // The stored preference is honoured up to what currently fits. Clamping for
  // display only — rather than writing the smaller value back — means shrinking
  // the window and widening it again restores the width the user chose.
  const aiWidth = Math.min(settings.aiPanelWidth, maxAiWidth);

  const commitAiWidth = useCallback(
    (width: number) => {
      updateSettings({ aiPanelWidth: Math.min(maxAiWidth, Math.max(MIN_AI_WIDTH, width)) });
    },
    [updateSettings, maxAiWidth]
  );

  const handleAiPointerDown = useCallback((e: React.PointerEvent<HTMLHRElement>) => {
    e.preventDefault(); // See handlePointerDown — stops a text selection starting.
    aiDraggingRef.current = true;
    setIsResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handleAiPointerMove = useCallback(
    (e: React.PointerEvent<HTMLHRElement>) => {
      if (!aiDraggingRef.current || !rowRef.current) return;
      const right = rowRef.current.getBoundingClientRect().right;
      commitAiWidth(right - e.clientX);
    },
    [commitAiWidth]
  );

  const handleAiPointerUp = useCallback(() => {
    aiDraggingRef.current = false;
    setIsResizing(false);
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

  const handleDividerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLHRElement>) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          commitEditorWidth(resolvedEditorWidth - KEYBOARD_SPLIT_STEP);
          break;
        case 'ArrowRight':
          e.preventDefault();
          commitEditorWidth(resolvedEditorWidth + KEYBOARD_SPLIT_STEP);
          break;
        case 'Home':
          e.preventDefault();
          commitEditorWidth(splitWidth * DEFAULT_RATIO);
          break;
        default:
          break;
      }
    },
    [commitEditorWidth, resolvedEditorWidth, splitWidth]
  );

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

      {/* Workspace row. The AI panel is a sibling of the document area rather
          than a child of it, so it is available from the empty state too —
          generating a diagram from nothing is the assistant's primary use, and
          nesting it under `hasDocument` made the toggle a no-op there. */}
      <div ref={rowRef} className={`flex min-h-0 flex-1 ${isResizing ? 'select-none' : ''}`}>
        {hasDocument ? (
          /* Workspace: Editor + Divider + Preview */
          <div ref={containerRef} className="relative flex min-h-0 flex-1">
            {/* Editor panel */}
            <div
              className="flex flex-col border-r border-neutral-200 dark:border-slate-700"
              style={{ flex: '0 0 auto', width: resolvedEditorWidth }}
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
              aria-valuenow={Math.round(resolvedEditorWidth)}
              aria-valuemin={MIN_EDITOR_WIDTH}
              aria-valuemax={Math.round(maxEditorWidth)}
              tabIndex={0}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onDoubleClick={handleDoubleClick}
              onKeyDown={handleDividerKeyDown}
              className={DIVIDER_CLASS}
            />

            {/* Preview panel */}
            {/* The elastic pane: the AI panel's width comes out of here, so the
                editor never moves when the panel is resized. */}
            <div className="flex min-w-0 flex-col" style={{ flex: '1 1 0' }}>
              <PreviewView source={editorText} onStatusChange={onPreviewStatusChange} />
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
          <div className="flex min-h-0 flex-1">
            <EmptyState isDragOver={isDragOver} />
          </div>
        )}

        {/* AI panel resize divider — only reachable while the panel is open,
            so it is not rendered (and not focusable) when collapsed. */}
        {showAIPanel && (
          <hr
            aria-label="Resize AI panel"
            aria-orientation="vertical"
            aria-valuenow={aiWidth}
            aria-valuemin={MIN_AI_WIDTH}
            aria-valuemax={maxAiWidth}
            tabIndex={0}
            onPointerDown={handleAiPointerDown}
            onPointerMove={handleAiPointerMove}
            onPointerUp={handleAiPointerUp}
            onDoubleClick={() => commitAiWidth(DEFAULT_AI_WIDTH)}
            onKeyDown={handleAiDividerKeyDown}
            className={DIVIDER_CLASS}
          />
        )}

        {/* AI panel. The wrapper animates its width between 0 and `aiWidth`
            while the inner element stays at full width, so the panel slides
            in from the right instead of its contents reflowing on every
            frame of the transition. `motion-safe:` leaves the animation out
            for users who ask the OS to reduce motion. */}
        <div
          className={`relative shrink-0 overflow-hidden border-l border-neutral-200 dark:border-slate-700 ${
            // The width transition exists for the open/close slide. Left on
            // during a drag it eases toward the pointer on a 200ms delay, so
            // the panel visibly lags behind the cursor.
            isResizing
              ? ''
              : 'motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out'
          }`}
          style={{ width: showAIPanel ? aiWidth : 0 }}
          // Kept mounted while collapsed so the conversation survives a
          // toggle; hidden from assistive tech and tab order at width 0.
          aria-hidden={!showAIPanel}
          inert={!showAIPanel}
        >
          {/* Absolutely positioned, NOT a normal-flow child. At full width
              inside a zero-width wrapper it would otherwise hang 360px off the
              right of the document: `overflow-hidden` clips the pixels, but an
              in-flow child still counts toward the document's scroll width.
              Chrome hides that; WKWebView reserves the space and paints an
              unfilled strip beside the window. Out of flow, the panel keeps its
              full width for the reveal without ever widening the document. */}
          <div className="absolute inset-y-0 right-0" style={{ width: aiWidth }}>
            <AIPanel
              messages={aiChat.messages}
              isStreaming={aiChat.isStreaming}
              pendingSuggestion={aiChat.pendingSuggestion}
              error={aiChat.error}
              onSend={onAiSend}
              onStop={aiChat.stop}
              onAcceptPending={aiChat.acceptPending}
              onCancelPending={aiChat.cancelPending}
              onClose={onToggleAIPanel}
              onOpenAiSettings={onOpenAiSettings}
            />
          </div>
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
