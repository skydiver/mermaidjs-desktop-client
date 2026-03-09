import { AlertTriangle, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type MermaidStatus, useMermaid } from '../hooks/useMermaid';
import { useSettings } from '../hooks/useSettings';

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
  const { isDiagramDark, settings } = useSettings();
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
    <div
      className={`relative flex flex-1 flex-col overflow-hidden ${isDiagramDark ? 'bg-slate-900' : 'bg-white'}`}
      style={settings.showDotGrid ? {
        backgroundImage: `radial-gradient(circle, ${isDiagramDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      } : undefined}
    >
      {/* Render target — useMermaid sets innerHTML here */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-auto p-8"
      />

      {/* Empty state */}
      {showEmpty && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className={`text-sm ${isDiagramDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
            Add Mermaid markup to see the preview.
          </p>
        </div>
      )}

      {/* Error state */}
      {showError && status.errorDetails && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="flex max-w-lg flex-col items-center gap-3 rounded-xl border border-amber-300/50 bg-amber-50/80 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
            <AlertTriangle className="h-8 w-8 text-amber-500 dark:text-amber-400" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Mermaid could not render this diagram
            </p>
            <p className="whitespace-pre-wrap text-center text-xs leading-relaxed text-amber-600/75 dark:text-amber-400/60">
              {formatMermaidError(status.errorDetails)}
            </p>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      {!showEmpty && (
        <div className={`absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border px-1 py-0.5 shadow-sm backdrop-blur ${isDiagramDark ? 'border-neutral-700 bg-neutral-800/90' : 'border-neutral-200 bg-white/90'}`}>
          <ZoomButton onClick={zoomOut} title="Zoom out" isDark={isDiagramDark}>
            <ZoomOut className="h-3.5 w-3.5" />
          </ZoomButton>
          <span className={`min-w-[3rem] text-center text-xs tabular-nums ${isDiagramDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {Math.round(zoom * 100)}%
          </span>
          <ZoomButton onClick={zoomIn} title="Zoom in" isDark={isDiagramDark}>
            <ZoomIn className="h-3.5 w-3.5" />
          </ZoomButton>
          <ZoomButton onClick={resetZoom} title="Reset zoom" isDark={isDiagramDark}>
            <RotateCcw className="h-3.5 w-3.5" />
          </ZoomButton>
        </div>
      )}
    </div>
  );
}

function formatMermaidError(message: string): string {
  // "No diagram type detected matching given configuration for text: <entire source>"
  // Truncate the embedded source text to keep the error readable
  const noTypeMatch = message.match(
    /^No diagram type detected matching given configuration for text:\s*([\s\S]*)/
  );
  if (noTypeMatch) {
    const source = noTypeMatch[1].trim();
    const truncated = source.length > 80 ? `${source.slice(0, 80)}…` : source;
    return `No diagram type detected for: ${truncated}`;
  }

  return message;
}

function ZoomButton({
  onClick,
  title,
  isDark,
  children,
}: {
  onClick: () => void;
  title: string;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded p-1 ${
        isDark
          ? 'text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
      }`}
    >
      {children}
    </button>
  );
}
