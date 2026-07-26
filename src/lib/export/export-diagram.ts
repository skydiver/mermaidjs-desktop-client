import { save as showSaveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import mermaid from 'mermaid';
import { reportError, reportWarning } from '../error-reporting';

// ── Types ───────────────────────────────────────────────

export type ExportFormat = 'png' | 'pngx2' | 'svg';

interface RenderedDiagram {
  svg: string;
  width: number;
  height: number;
}

// ── Constants ───────────────────────────────────────────

const PNG_MIN_BASE = 512;
const PNG_MIN_DOUBLE = 1024;

// WebKit (the macOS system WebView Tauri renders through) caps canvas
// dimensions at 16384px per axis. Past this, `canvas.toBlob()` returns
// `null` with no thrown error — the silent-failure mode this constant
// exists to prevent. Source: WebKit's `CanvasBase` size limit, empirically
// confirmed via `canvas.toBlob` returning `null` past this size on macOS.
const PNG_MAX_DIMENSION = 16384;

// Safari/WebKit additionally caps total canvas *area* well below what the
// per-dimension cap alone would allow for near-square diagrams — roughly
// 16,777,216px² (≈4096x4096) on some devices/memory configurations. Both
// caps are applied and whichever is more restrictive wins.
const PNG_MAX_AREA = 16_777_216;

const EXPORT_PADDING = 10;

// ── Public API ──────────────────────────────────────────

export async function exportDiagram(
  source: string,
  format: ExportFormat,
  baseName: string,
  isDiagramDark: boolean
): Promise<void> {
  const trimmed = source.trim();
  if (!trimmed.length) {
    await reportWarning('Cannot export an empty diagram.', {
      title: 'Nothing to Export',
      body: 'The diagram is empty, so there is nothing to export.',
    });
    return;
  }

  try {
    const rendered = await renderDiagram(trimmed);

    if (format === 'svg') {
      await exportAsSvg(rendered.svg, baseName);
      return;
    }

    const scale = format === 'pngx2' ? 2 : 1;
    await exportAsPng(rendered, baseName, scale, isDiagramDark);
  } catch (error) {
    await reportError('Failed to export diagram', error, {
      title: 'Export Failed',
      body: `Could not export the diagram as ${format.toUpperCase()}.`,
    });
  }
}

export function inferBaseName(path: string | null): string {
  if (!path) {
    return 'diagram';
  }

  const trimmed = path.trim();
  if (!trimmed) {
    return 'diagram';
  }

  const segments = trimmed.split(/[/\\]+/);
  const lastSegment = segments[segments.length - 1] ?? 'diagram';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex > 0) {
    return lastSegment.slice(0, dotIndex);
  }
  return lastSegment.length ? lastSegment : 'diagram';
}

// ── Private helpers ─────────────────────────────────────

async function exportAsSvg(svg: string, baseName: string): Promise<void> {
  const targetPath = await showSaveDialog({
    defaultPath: `${baseName}.svg`,
    filters: [
      { name: 'SVG Image', extensions: ['svg'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!targetPath) {
    return;
  }

  await writeTextFile(targetPath, svg);
}

async function exportAsPng(
  diagram: RenderedDiagram,
  baseName: string,
  scale: number,
  isDiagramDark: boolean
): Promise<void> {
  const suffix = scale > 1 ? '@2x' : '';
  const targetPath = await showSaveDialog({
    defaultPath: `${baseName}${suffix}.png`,
    filters: [
      { name: 'PNG Image', extensions: ['png'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!targetPath) {
    return;
  }

  const pngBytes = await convertSvgToPng(diagram, scale, isDiagramDark);
  await writeFile(targetPath, pngBytes);
}

async function renderDiagram(source: string): Promise<RenderedDiagram> {
  const renderId = `export-${Date.now()}`;
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.visibility = 'hidden';
  document.body.appendChild(container);

  try {
    const { svg } = await mermaid.render(renderId, source, container);
    let svgElement = container.querySelector('svg');

    if (!svgElement) {
      const tempWrapper = document.createElement('div');
      tempWrapper.innerHTML = svg;
      const parsed = tempWrapper.querySelector('svg');
      if (!parsed) {
        throw new Error('Mermaid render did not produce an SVG element.');
      }
      container.appendChild(parsed);
      svgElement = parsed;
    }

    return normalizeSvg(svgElement);
  } finally {
    container.remove();
    const leftover = document.getElementById(renderId);
    leftover?.remove();
  }
}

function normalizeSvg(svgElement: SVGSVGElement): RenderedDiagram {
  const ns = 'http://www.w3.org/2000/svg';
  const bbox = svgElement.getBBox();
  const paddedWidth = sanitizeDimension(bbox.width) + EXPORT_PADDING * 2;
  const paddedHeight = sanitizeDimension(bbox.height) + EXPORT_PADDING * 2;
  const minX = bbox.x - EXPORT_PADDING;
  const minY = bbox.y - EXPORT_PADDING;

  const normalized = svgElement.cloneNode(true) as SVGSVGElement;

  normalized.setAttribute('xmlns', normalized.getAttribute('xmlns') ?? ns);
  normalized.setAttribute('width', `${paddedWidth}`);
  normalized.setAttribute('height', `${paddedHeight}`);
  normalized.setAttribute('viewBox', `${minX} ${minY} ${paddedWidth} ${paddedHeight}`);
  normalized.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  normalized.removeAttribute('x');
  normalized.removeAttribute('y');

  const serialized = new XMLSerializer().serializeToString(normalized);
  return { svg: serialized, width: paddedWidth, height: paddedHeight };
}

function sanitizeDimension(value: number | null | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return value;
}

/**
 * Computes the actual pixel dimensions (and effective scale) used to render
 * the export canvas, given the SVG's natural `width`/`height` and the
 * requested export `scale` (1 for @1x, 2 for @2x).
 *
 * Two constraints are combined:
 * - A *floor*: the shortest side should be at least `PNG_MIN_BASE`px
 *   (`PNG_MIN_DOUBLE`px at @2x), so small diagrams still export at a
 *   reasonable resolution.
 * - A *ceiling*: neither dimension may exceed `PNG_MAX_DIMENSION`, and the
 *   total area may not exceed `PNG_MAX_AREA` — both are platform limits of
 *   the canvas itself, not aesthetic preferences.
 *
 * The floor and ceiling can conflict for extreme aspect ratios (e.g. a very
 * wide, very short diagram at @2x wants a large scale to grow the short
 * side, but that scale would blow the long side past the canvas limit). The
 * ceiling always wins: a smaller-than-ideal but still-legible export beats a
 * `canvas.toBlob()` that silently returns `null`.
 *
 * A single scalar is applied to both axes throughout, so the aspect ratio of
 * the input is always preserved in the output (subject to ±1px rounding).
 */
export function computeExportDimensions(
  width: number,
  height: number,
  scale: number
): { scale: number; width: number; height: number } {
  // `Math.max(1, NaN)` is `NaN`, not 1, so non-finite inputs must be rejected
  // explicitly or they propagate all the way to a NaN-sized canvas.
  const safeWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
  const safeHeight = Number.isFinite(height) ? Math.max(1, height) : 1;
  const safeScale = Number.isFinite(scale) ? Math.max(1, scale) : 1;

  const minDimension = safeScale > 1 ? PNG_MIN_DOUBLE : PNG_MIN_BASE;
  const floorScale = Math.max(safeScale, minDimension / safeWidth, minDimension / safeHeight);

  const maxScaleByDimension = PNG_MAX_DIMENSION / Math.max(safeWidth, safeHeight);
  const maxScaleByArea = Math.sqrt(PNG_MAX_AREA / (safeWidth * safeHeight));
  const ceilingScale = Math.min(maxScaleByDimension, maxScaleByArea);

  const finalScale = Math.min(floorScale, ceilingScale);

  const exportWidth = Math.min(PNG_MAX_DIMENSION, Math.max(1, Math.round(safeWidth * finalScale)));
  const exportHeight = Math.min(
    PNG_MAX_DIMENSION,
    Math.max(1, Math.round(safeHeight * finalScale))
  );

  return { scale: finalScale, width: exportWidth, height: exportHeight };
}

async function convertSvgToPng(
  diagram: RenderedDiagram,
  scale: number,
  isDiagramDark: boolean
): Promise<Uint8Array> {
  const { svg, width, height } = diagram;
  const dataUrl = encodeSvgDataUri(svg);

  const image = await loadImage(dataUrl, width, height);
  const { width: exportWidth, height: exportHeight } = computeExportDimensions(
    width,
    height,
    scale
  );

  const canvas = document.createElement('canvas');
  canvas.width = exportWidth;
  canvas.height = exportHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to acquire canvas context.');
  }

  context.save();
  context.globalAlpha = 1;
  context.fillStyle = isDiagramDark ? '#1b2537' : '#ffffff';
  context.fillRect(0, 0, exportWidth, exportHeight);
  context.restore();

  context.drawImage(image, 0, 0, exportWidth, exportHeight);

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Canvas export produced no data.'));
        }
      },
      'image/png',
      1
    );
  });

  const arrayBuffer = await pngBlob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

function encodeSvgDataUri(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/%0A/g, '')
    .replace(/%20/g, ' ')
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function loadImage(url: string, width: number, height: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = async () => {
      try {
        if ('decode' in image) {
          await image.decode();
        }
      } catch {
        // Ignore decode failures and fall back to onload pixels.
      }

      if (!image.naturalWidth || !image.naturalHeight) {
        image.width = width;
        image.height = height;
      }
      resolve(image);
    };
    image.onerror = (event) =>
      reject(event instanceof ErrorEvent ? event.error : new Error('Image failed to load.'));
    image.src = url;
  });
}
