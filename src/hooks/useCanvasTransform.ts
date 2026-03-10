import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

// ── Constants ───────────────────────────────────────────

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;
const ZOOM_STEP = 0.25;

// ── Types ───────────────────────────────────────────────

interface Transform {
  x: number;
  y: number;
  scale: number;
}

// ── Helpers ─────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Measure the natural (untransformed) dimensions of an element.
 * Temporarily removes the CSS transform, reads the bounding rect, then restores it.
 * The two style writes happen synchronously, so no visual flash occurs.
 */
function measureNaturalSize(el: Element): { width: number; height: number } | null {
  const htmlEl = el as HTMLElement;
  const prev = htmlEl.style.transform;
  htmlEl.style.transform = 'none';
  const rect = el.getBoundingClientRect();
  htmlEl.style.transform = prev;
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { width: rect.width, height: rect.height };
}

// ── Hook ────────────────────────────────────────────────

export function useCanvasTransform(containerRef: RefObject<HTMLDivElement | null>) {
  const tRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const [displayScale, setDisplayScale] = useState(1);
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const rafRef = useRef(0);

  const getContent = useCallback(
    () => containerRef.current?.firstElementChild as HTMLElement | SVGSVGElement | null,
    [containerRef]
  );

  // ── Apply transform to DOM ─────────────────────

  const applyTransform = useCallback(() => {
    const el = getContent();
    if (!el) return;
    const { x, y, scale } = tRef.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    el.style.transformOrigin = '0 0';
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setDisplayScale(tRef.current.scale);
    });
  }, [getContent]);

  // ── Centering helper ───────────────────────────

  const centerContent = useCallback(() => {
    const container = containerRef.current;
    const el = getContent();
    if (!container || !el) return;
    const size = measureNaturalSize(el);
    if (!size) return;
    const t = tRef.current;
    t.x = (container.clientWidth - size.width * t.scale) / 2;
    t.y = (container.clientHeight - size.height * t.scale) / 2;
    applyTransform();
  }, [containerRef, getContent, applyTransform]);

  // ── Zoom by step (for toolbar buttons) ─────────

  const zoomByStep = useCallback(
    (step: number) => {
      const container = containerRef.current;
      if (!container) return;
      const t = tRef.current;
      const cx = container.clientWidth / 2;
      const cy = container.clientHeight / 2;
      const newScale = clamp(t.scale + step, ZOOM_MIN, ZOOM_MAX);
      const ratio = newScale / t.scale;
      t.x = cx - ratio * (cx - t.x);
      t.y = cy - ratio * (cy - t.y);
      t.scale = newScale;
      applyTransform();
    },
    [containerRef, applyTransform]
  );

  const zoomIn = useCallback(() => zoomByStep(ZOOM_STEP), [zoomByStep]);
  const zoomOut = useCallback(() => zoomByStep(-ZOOM_STEP), [zoomByStep]);

  const resetView = useCallback(() => {
    tRef.current.scale = 1;
    centerContent();
  }, [centerContent]);

  const fitToViewport = useCallback(() => {
    const container = containerRef.current;
    const el = getContent();
    if (!container || !el) return;
    const size = measureNaturalSize(el);
    if (!size) return;

    const padding = 64; // 32px visual margin each side
    const availW = container.clientWidth - padding;
    const availH = container.clientHeight - padding;
    const scale = clamp(
      Math.round(Math.min(availW / size.width, availH / size.height) * 100) / 100,
      ZOOM_MIN,
      ZOOM_MAX
    );

    const t = tRef.current;
    t.scale = scale;
    t.x = (container.clientWidth - size.width * scale) / 2;
    t.y = (container.clientHeight - size.height * scale) / 2;
    applyTransform();
  }, [containerRef, getContent, applyTransform]);

  // ── Wheel zoom (cursor-anchored, smooth) ───────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = tRef.current;
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const factor = Math.pow(0.999, e.deltaY);
      const newScale = clamp(t.scale * factor, ZOOM_MIN, ZOOM_MAX);
      const ratio = newScale / t.scale;

      t.x = mx - ratio * (mx - t.x);
      t.y = my - ratio * (my - t.y);
      t.scale = newScale;
      applyTransform();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [containerRef, applyTransform]);

  // ── Drag-to-pan ────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      e.preventDefault();
    };

    const handleMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      const t = tRef.current;
      t.x += e.clientX - d.lastX;
      t.y += e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      applyTransform();
    };

    const handleUp = () => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      container.style.cursor = '';
      container.style.userSelect = '';
    };

    container.addEventListener('mousedown', handleDown);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      container.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [containerRef, applyTransform]);

  // ── Content change handler ─────────────────────
  // Called by PreviewView when useMermaid re-renders the diagram.
  // Always fits to viewport — the SVG is fully replaced on each render,
  // so maintaining a previous transform across renders isn't meaningful.

  const reapplyTransform = useCallback(() => {
    const el = getContent();
    if (!el) return;
    fitToViewport();
  }, [getContent, fitToViewport]);

  // Cleanup RAF on unmount
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { displayScale, zoomIn, zoomOut, resetView, fitToViewport, reapplyTransform };
}
