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

async function exportAsPng(diagram: RenderedDiagram, baseName: string, scale: number): Promise<void> {
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
  container.style.width = '0';
  container.style.height = '0';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.visibility = 'hidden';
  document.body.appendChild(container);

  try {
    const { svg } = await mermaid.render(renderId, source, undefined, container);
    return normalizeSvg(svg);
  } finally {
    container.remove();
    const leftover = document.getElementById(renderId);
    leftover?.remove();
  }
}

function normalizeSvg(source: string): RenderedDiagram {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(source, 'image/svg+xml');
  const svgElement = parsed.querySelector('svg');

  if (!svgElement) {
    throw new Error('Rendered diagram did not produce an SVG element.');
  }

  let width = parseDimension(svgElement.getAttribute('width'));
  let height = parseDimension(svgElement.getAttribute('height'));
  const viewBox = svgElement.getAttribute('viewBox');

  if ((!width || !height) && viewBox) {
    const parts = viewBox.trim().split(/\s+/);
    if (parts.length === 4) {
      const viewWidth = Number.parseFloat(parts[2] ?? '');
      const viewHeight = Number.parseFloat(parts[3] ?? '');
      if ((!width || Number.isNaN(width)) && Number.isFinite(viewWidth)) {
        width = viewWidth;
      }
      if ((!height || Number.isNaN(height)) && Number.isFinite(viewHeight)) {
        height = viewHeight;
      }
    }
  }

  width = sanitizeDimension(width);
  height = sanitizeDimension(height);

  svgElement.setAttribute('width', `${width}`);
  svgElement.setAttribute('height', `${height}`);
  svgElement.setAttribute('xmlns', svgElement.getAttribute('xmlns') ?? 'http://www.w3.org/2000/svg');

  const serialized = new XMLSerializer().serializeToString(svgElement);
  return { svg: serialized, width, height };
}

function parseDimension(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]+)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1] ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeDimension(value: number | null | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return 1024;
  }
  return value;
}

async function convertSvgToPng(diagram: RenderedDiagram, scale: number): Promise<Uint8Array> {
  const { svg, width, height } = diagram;
  const dataUrl = encodeSvgDataUri(svg);

  const image = await loadImage(dataUrl, width, height);
  const exportWidth = Math.max(1, Math.round(width * scale));
  const exportHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = exportWidth;
  canvas.height = exportHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to acquire canvas context.');
  }

  context.clearRect(0, 0, exportWidth, exportHeight);
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
    image.onerror = (event) => reject(event instanceof ErrorEvent ? event.error : new Error('Image failed to load.'));
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
