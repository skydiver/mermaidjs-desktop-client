import { save as showSaveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { EditorView } from 'codemirror';
import mermaid from 'mermaid';

import type { ExportFormat } from './export-menu';

interface ExportDiagramOptions {
  editor: EditorView;
  getPath: () => string | null;
}

interface RenderedDiagram {
  svg: string;
  width: number;
  height: number;
}

const PNG_MIN_BASE = 512;
const PNG_MIN_DOUBLE = 1024;
const EXPORT_PADDING = 10;

export function createExportHandler({ editor, getPath }: ExportDiagramOptions) {
  return async (format: ExportFormat) => {
    const documentContent = editor.state.doc.toString().trim();
    if (!documentContent.length) {
      console.warn('Cannot export an empty diagram.');
      return;
    }

    try {
      const rendered = await renderDiagram(documentContent);
      const baseName = inferBaseName(getPath());

      if (format === 'svg') {
        await exportAsSvg(rendered.svg, baseName);
        return;
      }

      const scale = format === 'pngx2' ? 2 : 1;
      await exportAsPng(rendered, baseName, scale);
    } catch (error) {
      console.error('Failed to export diagram', error);
    }
  };
}

async function exportAsSvg(svg: string, baseName: string): Promise<void> {
  const targetPath = await showSaveDialog({
    defaultPath: `${baseName}.svg`,
    filters: [
      {
        name: 'SVG Image',
        extensions: ['svg'],
      },
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
  scale: number
): Promise<void> {
  const suffix = scale > 1 ? '@2x' : '';
  const targetPath = await showSaveDialog({
    defaultPath: `${baseName}${suffix}.png`,
    filters: [
      {
        name: 'PNG Image',
        extensions: ['png'],
      },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!targetPath) {
    return;
  }

  const pngBytes = await convertSvgToPng(diagram, scale);
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

async function convertSvgToPng(diagram: RenderedDiagram, scale: number): Promise<Uint8Array> {
  const { svg, width, height } = diagram;
  const dataUrl = encodeSvgDataUri(svg);

  const image = await loadImage(dataUrl, width, height);
  const minDimension = scale > 1 ? PNG_MIN_DOUBLE : PNG_MIN_BASE;
  const requiredScale = Math.max(scale, minDimension / width, minDimension / height);
  const exportWidth = Math.max(1, Math.round(width * requiredScale));
  const exportHeight = Math.max(1, Math.round(height * requiredScale));

  const canvas = document.createElement('canvas');
  canvas.width = exportWidth;
  canvas.height = exportHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to acquire canvas context.');
  }

  context.save();
  context.globalAlpha = 1;
  context.fillStyle = '#ffffff';
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

function inferBaseName(path: string | null): string {
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
