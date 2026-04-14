import { AlertTriangle, Crosshair, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useCanvasTransform } from '../hooks/useCanvasTransform';
import { type MermaidStatus, useMermaid } from '../hooks/useMermaid';
import { useSettings } from '../hooks/useSettings';

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
  const { displayScale, zoomIn, zoomOut, resetView, fitToViewport, reapplyTransform } =
    useCanvasTransform(containerRef);

  // Schedule render when source changes
  useEffect(() => {
    schedule(source);
  }, [source, schedule]);

  // Report status changes to parent
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Reapply transform after mermaid re-renders the SVG
  useEffect(() => {
    if (status.level === 'success' || status.level === 'idle') {
      reapplyTransform();
    }
  }, [status, reapplyTransform]);

  const showEmpty = !source.trim().length;
  const showError = status.level === 'error';

  return (
    <div
      className={`relative flex flex-1 flex-col overflow-hidden ${isDiagramDark ? 'bg-slate-900' : 'bg-white'}`}
      style={
        settings.showDotGrid
          ? {
              backgroundImage: `radial-gradient(circle, ${isDiagramDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'} 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }
          : undefined
      }
    >
      {/* Render target — useMermaid sets innerHTML here */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden" />

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
      {!showEmpty && !showError && (
        <div
          className={`absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border px-1 py-0.5 shadow-sm backdrop-blur ${isDiagramDark ? 'border-neutral-700 bg-neutral-800/90' : 'border-neutral-200 bg-white/90'}`}
        >
          <ZoomButton onClick={zoomOut} title="Zoom out" isDark={isDiagramDark}>
            <ZoomOut className="h-3.5 w-3.5" />
          </ZoomButton>
          <span
            className={`min-w-[3rem] text-center text-xs tabular-nums ${isDiagramDark ? 'text-neutral-400' : 'text-neutral-500'}`}
          >
            {Math.round(displayScale * 100)}%
          </span>
          <ZoomButton onClick={zoomIn} title="Zoom in" isDark={isDiagramDark}>
            <ZoomIn className="h-3.5 w-3.5" />
          </ZoomButton>
          <div
            className={`mx-0.5 h-4 w-px ${isDiagramDark ? 'bg-neutral-600' : 'bg-neutral-200'}`}
          />
          <ZoomButton onClick={resetView} title="Reset zoom" isDark={isDiagramDark}>
            <RotateCcw className="h-3.5 w-3.5" />
          </ZoomButton>
          <ZoomButton onClick={fitToViewport} title="Fit to viewport" isDark={isDiagramDark}>
            <Crosshair className="h-3.5 w-3.5" />
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
