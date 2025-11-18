import { getCurrentWindow } from '@tauri-apps/api/window';
import { Store } from '@tauri-apps/plugin-store';

import { debounce } from '../utils/debounce';

const SETTINGS_STORE_NAME = 'settings.store';
const WINDOW_STATE_KEY = 'windowState';
const EDITOR_ZOOM_KEY = 'editorZoom';

export interface WindowStatePayload {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

export type AppWindow = ReturnType<typeof getCurrentWindow>;

export async function loadSettingsStore(): Promise<Store | null> {
  try {
    return await Store.load(SETTINGS_STORE_NAME);
  } catch (error) {
    console.error('Failed to load settings store', error);
    return null;
  }
}

export async function setupWindowPersistence(
  store: Store,
  appWindow: AppWindow,
  persistDelay: number
): Promise<void> {
  const debouncedPersist = debounce(() => persistWindowState(store, appWindow), persistDelay);

  const unlistenResize = await appWindow.onResized(() => debouncedPersist());
  const unlistenMove = await appWindow.onMoved(() => debouncedPersist());

  await appWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    await persistWindowState(store, appWindow);
    if (typeof unlistenResize === 'function') unlistenResize();
    if (typeof unlistenMove === 'function') unlistenMove();
    await appWindow.close();
  });
}

export async function persistWindowState(store: Store, appWindow: AppWindow): Promise<void> {
  try {
    const [size, position, maximized] = await Promise.all([
      appWindow.outerSize(),
      appWindow.outerPosition(),
      appWindow.isMaximized(),
    ]);

    const windowState: WindowStatePayload = {
      width: size ? Math.round(size.width) : undefined,
      height: size ? Math.round(size.height) : undefined,
      x: position ? Math.round(position.x) : undefined,
      y: position ? Math.round(position.y) : undefined,
      maximized: Boolean(maximized),
    };

    await store.set(WINDOW_STATE_KEY, windowState);
    await store.save();
  } catch (error) {
    console.warn('Persisting window state failed', error);
  }
}

export async function loadEditorZoom(store: Store): Promise<number | null> {
  try {
    const zoom = await store.get<number>(EDITOR_ZOOM_KEY);
    return zoom ?? null;
  } catch (error) {
    console.warn('Loading editor zoom failed', error);
    return null;
  }
}

export async function saveEditorZoom(store: Store, level: number): Promise<void> {
  try {
    await store.set(EDITOR_ZOOM_KEY, level);
    await store.save();
  } catch (error) {
    console.warn('Saving editor zoom failed', error);
  }
}
