const ZOOM_MIN = 0.25;
const ZOOM_MAX = 10;
const ZOOM_STEP = 0.25;
const ZOOM_DEFAULT = 1;

export interface ZoomController {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  getLevel: () => number;
  applyZoom: () => void;
}

export function createZoomController(
  previewEl: HTMLElement,
  onZoomChange?: (level: number) => void
): ZoomController {
  let zoomLevel = ZOOM_DEFAULT;

  function applyZoom(): void {
    const svg = previewEl.querySelector('svg');
    if (svg) {
      svg.style.transform = `scale(${zoomLevel})`;
      svg.style.transformOrigin = 'center center';
    }
    onZoomChange?.(zoomLevel);
  }

  function zoomIn(): void {
    if (zoomLevel < ZOOM_MAX) {
      zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP);
      applyZoom();
    }
  }

  function zoomOut(): void {
    if (zoomLevel > ZOOM_MIN) {
      zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP);
      applyZoom();
    }
  }

  function reset(): void {
    zoomLevel = ZOOM_DEFAULT;
    applyZoom();
  }

  function getLevel(): number {
    return zoomLevel;
  }

  return {
    zoomIn,
    zoomOut,
    reset,
    getLevel,
    applyZoom,
  };
}

export function setupZoomControls(
  controller: ZoomController,
  zoomInBtn: HTMLElement | null,
  zoomOutBtn: HTMLElement | null,
  resetBtn: HTMLElement | null,
  levelDisplay?: HTMLElement | null
): void {
  zoomInBtn?.addEventListener('click', () => {
    controller.zoomIn();
  });

  zoomOutBtn?.addEventListener('click', () => {
    controller.zoomOut();
  });

  resetBtn?.addEventListener('click', () => {
    controller.reset();
  });

  if (levelDisplay) {
    updateLevelDisplay(levelDisplay, controller.getLevel());
  }
}

export function setupWheelZoom(previewEl: HTMLElement, controller: ZoomController): void {
  previewEl.addEventListener(
    'wheel',
    (event) => {
      // Zoom with Ctrl+Scroll (also handles trackpad pinch-to-zoom)
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.deltaY < 0) {
        controller.zoomIn();
      } else if (event.deltaY > 0) {
        controller.zoomOut();
      }
    },
    { passive: false, capture: true }
  );
}

export function updateLevelDisplay(element: HTMLElement, level: number): void {
  element.textContent = `${Math.round(level * 100)}%`;
}
