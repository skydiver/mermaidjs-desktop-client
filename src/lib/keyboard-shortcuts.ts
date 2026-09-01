// ── Types ────────────────────────────────────────────────

/** The application's ⌘/Ctrl shortcuts, named rather than keyed by character. */
export type ShortcutId = 'new' | 'open' | 'save' | 'toggle-ai' | 'settings' | 'help';

/** The subset of `KeyboardEvent` the resolver reads. */
export interface ShortcutEvent {
  key: string;
  code: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

// ── Constants ────────────────────────────────────────────

/**
 * Shortcuts that open a native dialog, mutate the document (New/Open/Save) or
 * restructure the workspace behind the modal (the AI panel toggle). All must
 * stay inert while a modal is open, matching
 * `toolbarDisabled={showSettings || showHelp}`.
 */
const MODAL_GATED: ReadonlySet<ShortcutId> = new Set<ShortcutId>([
  'new',
  'open',
  'save',
  'toggle-ai',
]);

// ── Helpers ──────────────────────────────────────────────

/**
 * Whether the event is this key, by character OR by physical position.
 *
 * `key` alone is not enough. With ⌘⇧A on a layout where that combination
 * begins an accent composition, WebKit reports `key: 'Dead'` — the AI panel
 * shortcut silently did nothing in the app while working in Chrome, which
 * reports `'A'`. `code` is the physical key and is immune to composition,
 * modifiers and the active layout.
 *
 * `key` is still tried first so a remapped layout keeps matching the character
 * the user actually typed; `code` is only the fallback for when it is unusable.
 */
function matches(e: ShortcutEvent, key: string, code: string): boolean {
  return e.key.toLowerCase() === key || e.code === code;
}

// ── Resolution ───────────────────────────────────────────

/**
 * Maps a keydown to the shortcut it triggers, or `null` if it triggers none.
 *
 * Shift is significant: ⌘A is the native Select All and ⌘⇧S is unbound, so
 * neither may be claimed by the shortcuts that share their physical key.
 */
export function resolveShortcut(e: ShortcutEvent): ShortcutId | null {
  if (!(e.metaKey || e.ctrlKey)) return null;

  if (e.shiftKey) {
    if (matches(e, 'a', 'KeyA')) return 'toggle-ai';
    // ⌘⇧/ — the character is '?' on a US layout but not on every other one.
    if (e.key === '?' || e.code === 'Slash') return 'help';
    return null;
  }

  if (matches(e, 'n', 'KeyN')) return 'new';
  if (matches(e, 'o', 'KeyO')) return 'open';
  if (matches(e, 's', 'KeyS')) return 'save';
  if (matches(e, ',', 'Comma')) return 'settings';

  return null;
}

/**
 * Whether the shortcut must be ignored while the Settings or Help dialog is
 * open. The dialog shortcuts stay live so ⌘, and ⌘? can switch between them.
 */
export function isModalGated(id: ShortcutId): boolean {
  return MODAL_GATED.has(id);
}
