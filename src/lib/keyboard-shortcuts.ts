// ── Constants ────────────────────────────────────────────

/** Keys whose ⌘/Ctrl-modified action opens a native dialog, mutates the
 * document (New/Open/Save), or restructures the workspace behind the modal
 * (⌘⇧A toggles the AI panel — `'A'` is uppercase because Shift is held).
 * All must stay inert while a modal is open, matching
 * `toolbarDisabled={showSettings || showHelp}`. */
const MODAL_GATED_KEYS = new Set(['n', 'o', 's', 'A']);

// ── Helpers ──────────────────────────────────────────────

/**
 * Whether a ⌘/Ctrl-modified keydown should be handled, given whether a
 * modal (Settings or Help) is currently open. File shortcuts (New/Open/Save)
 * are inert while a modal is open; all other shortcuts are unaffected.
 */
export function shouldHandleFileShortcut(key: string, modalOpen: boolean): boolean {
  if (!modalOpen) return true;
  return !MODAL_GATED_KEYS.has(key);
}
