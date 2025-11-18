import { Compartment } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 1;
const BASE_FONT_SIZE = 16;

export interface EditorZoomController {
  zoomIn: () => boolean;
  zoomOut: () => boolean;
  reset: () => boolean;
  getLevel: () => number;
}

export function createEditorZoomExtension(): {
  extension: ReturnType<Compartment['of']>;
  compartment: Compartment;
} {
  const compartment = new Compartment();
  const extension = compartment.of(createFontSizeTheme(ZOOM_DEFAULT));
  return { extension, compartment };
}

export function createEditorZoomController(
  view: EditorView,
  compartment: Compartment,
  onZoomChange?: (level: number) => void,
  initialLevel?: number
): EditorZoomController {
  let zoomLevel = initialLevel ?? ZOOM_DEFAULT;

  // Apply initial zoom if different from default
  if (initialLevel && initialLevel !== ZOOM_DEFAULT) {
    view.dispatch({
      effects: compartment.reconfigure(createFontSizeTheme(zoomLevel)),
    });
  }

  function applyZoom(): void {
    view.dispatch({
      effects: compartment.reconfigure(createFontSizeTheme(zoomLevel)),
    });
    onZoomChange?.(zoomLevel);
  }

  function zoomIn(): boolean {
    if (zoomLevel < ZOOM_MAX) {
      zoomLevel = Math.min(ZOOM_MAX, Math.round((zoomLevel + ZOOM_STEP) * 10) / 10);
      applyZoom();
    }
    return true;
  }

  function zoomOut(): boolean {
    if (zoomLevel > ZOOM_MIN) {
      zoomLevel = Math.max(ZOOM_MIN, Math.round((zoomLevel - ZOOM_STEP) * 10) / 10);
      applyZoom();
    }
    return true;
  }

  function reset(): boolean {
    zoomLevel = ZOOM_DEFAULT;
    applyZoom();
    return true;
  }

  function getLevel(): number {
    return zoomLevel;
  }

  return {
    zoomIn,
    zoomOut,
    reset,
    getLevel,
  };
}

export function createEditorZoomKeymap(controller: EditorZoomController) {
  return keymap.of([
    {
      key: 'Mod-=',
      run: () => controller.zoomIn(),
    },
    {
      key: 'Mod-+',
      run: () => controller.zoomIn(),
    },
    {
      key: 'Mod--',
      run: () => controller.zoomOut(),
    },
    {
      key: 'Mod-0',
      run: () => controller.reset(),
    },
  ]);
}

function createFontSizeTheme(zoomLevel: number) {
  const fontSize = Math.round(BASE_FONT_SIZE * zoomLevel);
  return EditorView.theme({
    '.cm-scroller': {
      fontSize: `${fontSize}px`,
    },
  });
}
