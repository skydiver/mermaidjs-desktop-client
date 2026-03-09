import mermaid from 'mermaid';
import zenuml from '@mermaid-js/mermaid-zenuml';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { debounce } from '../lib/debounce';
import { useSettings } from './useSettings';

// ── Types ───────────────────────────────────────────────

export type RenderStatus = 'idle' | 'loading' | 'success' | 'error';

export interface MermaidStatus {
  message: string;
  level: RenderStatus;
  errorDetails?: string;
}

// ── Constants ───────────────────────────────────────────

const RENDER_DELAY = 300;

// Register external diagram types once at module level
await mermaid.registerExternalDiagrams([zenuml]);

// ── Hook ────────────────────────────────────────────────

export function useMermaid(containerRef: RefObject<HTMLElement | null>): {
  schedule: (source: string) => void;
  render: (source: string) => void;
  status: MermaidStatus;
} {
  const { isDiagramDark } = useSettings();
  const [status, setStatus] = useState<MermaidStatus>({ message: 'Ready', level: 'idle' });
  const tokenRef = useRef(0);
  const lastSourceRef = useRef('');

  const executeRender = useCallback(
    async (source: string, token: number) => {
      if (token !== tokenRef.current) return;

      const container = containerRef.current;
      if (!container) return;

      const trimmed = source.trim();
      if (!trimmed.length) {
        container.innerHTML = '';
        setStatus({ message: 'Ready', level: 'idle' });
        return;
      }

      // Sandbox for mermaid rendering — removed after render completes
      const sandbox = document.createElement('div');
      sandbox.setAttribute('aria-hidden', 'true');
      sandbox.style.position = 'absolute';
      sandbox.style.width = '0';
      sandbox.style.height = '0';
      sandbox.style.overflow = 'hidden';
      sandbox.style.pointerEvents = 'none';
      container.append(sandbox);

      try {
        const renderId = `mermaid-${Date.now()}-${token}`;
        const { svg } = await mermaid.render(renderId, trimmed, sandbox);
        if (token !== tokenRef.current) return;
        container.innerHTML = svg;
        setStatus({ message: 'Rendered', level: 'success' });
      } catch (error) {
        if (token !== tokenRef.current) return;
        const details = error instanceof Error ? error.message : String(error ?? 'Unknown error');
        console.error('Mermaid render failed', error);
        container.innerHTML = '';
        setStatus({ message: 'Render error', level: 'error', errorDetails: details });
      } finally {
        sandbox.remove();
      }
    },
    [containerRef]
  );

  // Keep executeRender accessible to the stable debounced function
  const renderFnRef = useRef(executeRender);
  renderFnRef.current = executeRender;

  // Stable debounced render — created once, calls latest executeRender via ref
  const debouncedRenderRef = useRef(
    debounce((source: string, token: number) => {
      renderFnRef.current(source, token);
    }, RENDER_DELAY)
  );

  // Initialize mermaid and re-render on theme changes
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDiagramDark ? 'dark' : 'default',
      securityLevel: 'loose',
    });

    // Re-render existing content with new theme
    if (lastSourceRef.current.trim()) {
      tokenRef.current += 1;
      const token = tokenRef.current;
      executeRender(lastSourceRef.current, token);
    }
  }, [isDiagramDark, executeRender]);

  const schedule = useCallback((source: string) => {
    lastSourceRef.current = source;
    tokenRef.current += 1;
    const token = tokenRef.current;
    setStatus({ message: 'Rendering...', level: 'loading' });
    debouncedRenderRef.current(source, token);
  }, []);

  const render = useCallback(
    (source: string) => {
      lastSourceRef.current = source;
      tokenRef.current += 1;
      const token = tokenRef.current;
      setStatus({ message: 'Rendering...', level: 'loading' });
      executeRender(source, token);
    },
    [executeRender]
  );

  return { schedule, render, status };
}
