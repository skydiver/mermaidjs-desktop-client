// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileHandling } from '../../src/hooks/useFileHandling';

// The dialogs are the whole subject here: what these tests pin down is that a
// cancelled dialog is reported back to the caller, not swallowed.
const ask = vi.fn();
const showOpenDialog = vi.fn();
vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: (...args: unknown[]) => ask(...args),
  open: (...args: unknown[]) => showOpenDialog(...args),
  save: vi.fn(),
}));

const readTextFile = vi.fn();
const stat = vi.fn();
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: (...args: unknown[]) => readTextFile(...args),
  stat: (...args: unknown[]) => stat(...args),
  writeTextFile: vi.fn(),
}));

function setup() {
  return renderHook(() =>
    useFileHandling({
      editorRef: { current: null },
      onContentReplace: vi.fn(),
      isDiagramDark: false,
    })
  );
}

/** Puts the hook in the state the bug needs: a document with unsaved edits. */
async function withDirtyDocument() {
  const view = setup();
  await act(async () => {
    await view.result.current.newFile();
  });
  act(() => {
    view.result.current.markDirty();
  });
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// App clears the AI conversation whenever a new document replaces the old one.
// These all used to resolve to `undefined` whether or not anything happened,
// so cancelling New or Open wiped a conversation about a diagram that was
// still on screen.
describe('useFileHandling reports whether the document was replaced', () => {
  it('returns true when a new file replaces a clean document', async () => {
    const { result } = setup();
    let replaced: boolean | undefined;
    await act(async () => {
      replaced = await result.current.newFile();
    });
    expect(replaced).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('returns false when the discard prompt is declined on New', async () => {
    const view = await withDirtyDocument();
    ask.mockResolvedValue(false);

    let replaced: boolean | undefined;
    await act(async () => {
      replaced = await view.result.current.newFile();
    });

    expect(ask).toHaveBeenCalled();
    expect(replaced).toBe(false);
  });

  it('returns true when the discard prompt is accepted on New', async () => {
    const view = await withDirtyDocument();
    ask.mockResolvedValue(true);

    let replaced: boolean | undefined;
    await act(async () => {
      replaced = await view.result.current.newFile();
    });

    expect(replaced).toBe(true);
  });

  it('returns false when the Open dialog is cancelled', async () => {
    const { result } = setup();
    showOpenDialog.mockResolvedValue(null);

    let replaced: boolean | undefined;
    await act(async () => {
      replaced = await result.current.openFile();
    });

    expect(replaced).toBe(false);
    expect(ask).not.toHaveBeenCalled();
  });

  it('returns false when the discard prompt is declined on Open', async () => {
    const view = await withDirtyDocument();
    showOpenDialog.mockResolvedValue('/tmp/diagram.mmd');
    ask.mockResolvedValue(false);

    let replaced: boolean | undefined;
    await act(async () => {
      replaced = await view.result.current.openFile();
    });

    expect(replaced).toBe(false);
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it('returns true when a file is actually opened', async () => {
    const { result } = setup();
    showOpenDialog.mockResolvedValue('/tmp/diagram.mmd');
    stat.mockResolvedValue({ size: 42 });
    readTextFile.mockResolvedValue('graph TD;\n  A-->B;');

    let replaced: boolean | undefined;
    await act(async () => {
      replaced = await result.current.openFile();
    });

    expect(replaced).toBe(true);
  });

  it('returns false when the example load is declined', async () => {
    const view = await withDirtyDocument();
    ask.mockResolvedValue(false);

    let replaced: boolean | undefined;
    await act(async () => {
      replaced = await view.result.current.loadExample('graph TD;');
    });

    expect(replaced).toBe(false);
  });
});
