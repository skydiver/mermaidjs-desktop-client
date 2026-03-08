import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type MermaidStatus, useMermaid } from '../hooks/useMermaid';

// ── Constants ───────────────────────────────────────────

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 10;
const ZOOM_STEP = 0.25;

// ── Props ───────────────────────────────────────────────

interface PreviewViewProps {
  source?: string;
  onStatusChange?: (status: MermaidStatus) => void;
}

// ── Component ───────────────────────────────────────────

export default function PreviewView({ source = '', onStatusChange }: PreviewViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { schedule, status } = useMermaid(containerRef);
  const [zoom, setZoom] = useState(1);

  // Schedule render when source changes
  useEffect(() => {
    schedule(source);
  }, [source, schedule]);

  // Report status changes to parent
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // ── Zoom handlers ───────────────────────────────────

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  // Ctrl+Scroll zoom (also handles trackpad pinch-to-zoom)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY < 0) {
        setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
      } else if (e.deltaY > 0) {
        setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
      }
    };

    el.addEventListener('wheel', handler, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', handler, true);
  }, []);

  // Apply zoom transform to rendered SVG
  useEffect(() => {
    const svg = containerRef.current?.querySelector('svg');
    if (svg instanceof SVGSVGElement) {
      svg.style.transform = `scale(${zoom})`;
      svg.style.transformOrigin = 'center center';
    }
  }, [zoom, status]);

  const showEmpty = !source.trim().length;
  const showError = status.level === 'error';

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-white dark:bg-neutral-900">
      {/* Render target — useMermaid sets innerHTML here */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-auto p-8"
      />

      {/* Empty state */}
      {showEmpty && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-neutral-400 dark:text-neutral-500">
            Add Mermaid markup to see the preview.
          </p>
        </div>
      )}

      {/* Error state */}
      {showError && status.errorDetails && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <p className="text-sm font-medium text-red-500 dark:text-red-400">
              Mermaid could not render this diagram.
            </p>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-red-400/75 dark:text-red-500/75">
              {status.errorDetails}
            </pre>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      {!showEmpty && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-neutral-200 bg-white/90 px-1 py-0.5 shadow-sm backdrop-blur dark:border-neutral-700 dark:bg-neutral-800/90">
          <button
            type="button"
            onClick={zoomOut}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            title="Reset zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
