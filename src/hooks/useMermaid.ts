import zenuml from '@mermaid-js/mermaid-zenuml';
import mermaid from 'mermaid';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { debounce } from '../lib/debounce';
import { reportError } from '../lib/error-reporting';
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
try {
  await mermaid.registerExternalDiagrams([zenuml]);
} catch (error) {
  // Do not await — this runs at module-eval time, before the app has
  // rendered, and blocking here would hold up first paint until the
  // user dismisses the dialog. reportError never throws.
  void reportError('Failed to register ZenUML diagram type', error, {
    title: 'Diagram Type Unavailable',
    body: 'ZenUML sequence diagrams could not be registered and will not render correctly.',
  });
}

// ── Hook ────────────────────────────────────────────────

export function useMermaid(containerRef: RefObject<HTMLElement | null>): {
  schedule: (source: string) => void;
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

      // Sandbox for mermaid rendering — removed after render completes.
      // Must have real dimensions because some renderers (Gantt, ZenUML) use
      // the container's width to calculate the output size.
      const sandbox = document.createElement('div');
      sandbox.setAttribute('aria-hidden', 'true');
      sandbox.style.position = 'absolute';
      sandbox.style.width = `${container.clientWidth}px`;
      sandbox.style.height = `${container.clientHeight}px`;
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

  // Stable debounced render — created once, calls latest executeRender via
  // ref. `useState` with an initializer rather than `useRef(debounce(...))`,
  // which would re-evaluate `debounce(...)` on every render and discard all
  // but the first result. Matches the form used in `useSettings`.
  const [debouncedRender] = useState(() =>
    debounce((source: string, token: number) => {
      renderFnRef.current(source, token);
    }, RENDER_DELAY)
  );

  // Initialize mermaid and re-render on theme changes
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDiagramDark ? 'dark' : 'default',
      securityLevel: 'strict',
    });

    // Re-render existing content with new theme
    if (lastSourceRef.current.trim()) {
      tokenRef.current += 1;
      const token = tokenRef.current;
      executeRender(lastSourceRef.current, token);
    }
  }, [isDiagramDark, executeRender]);

  // Cancel debounced render on unmount
  useEffect(() => {
    return () => debouncedRender.cancel();
  }, [debouncedRender]);

  const schedule = useCallback(
    (source: string) => {
      lastSourceRef.current = source;
      tokenRef.current += 1;
      const token = tokenRef.current;
      setStatus({ message: 'Rendering...', level: 'loading' });
      debouncedRender(source, token);
    },
    [debouncedRender]
  );

  return { schedule, status };
}
