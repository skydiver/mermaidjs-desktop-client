import { message } from '@tauri-apps/plugin-dialog';

// ── Types ───────────────────────────────────────────────

export interface ErrorDialogOptions {
  /** Dialog title, shown in the native dialog chrome. */
  title: string;
  /** User-facing description of what failed. The underlying error's message is appended. */
  body: string;
}

export interface WarningDialogOptions {
  title: string;
  body: string;
}

// ── Pure helpers (unit-testable) ───────────────────────────

/**
 * Formats a user-facing message for a failed operation, appending the
 * underlying error's message (if any) so the dialog is actionable rather
 * than generic.
 */
export function formatErrorMessage(body: string, error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  return `${body}\n\n${reason}`;
}

/**
 * De-duplication predicate for background/watcher failures: a failure for
 * `path` should only be reported to the user if it was not the most recently
 * reported failure for that same path. Callers should reset
 * `lastReportedPath` to `null` after a subsequent success so a *new* failure
 * on the same path is reported again.
 */
export function shouldReportWatchFailure(path: string, lastReportedPath: string | null): boolean {
  return path !== lastReportedPath;
}

// ── Side-effecting helpers ─────────────────────────────────

/**
 * Reports a failure to the user via a native dialog, and always logs the
 * original error to the console for local debugging. Never throws — if the
 * dialog itself fails to display, that secondary failure is only logged, to
 * avoid a reporting failure loop.
 */
export async function reportError(
  consoleLabel: string,
  error: unknown,
  dialog: ErrorDialogOptions
): Promise<void> {
  console.error(consoleLabel, error);
  try {
    await message(formatErrorMessage(dialog.body, error), {
      title: dialog.title,
      kind: 'error',
    });
  } catch (dialogError) {
    console.error('Failed to display error dialog', dialogError);
  }
}

/**
 * Reports a non-error, user-relevant condition (e.g. "nothing to export")
 * via a native dialog. Always logs to the console. Never throws.
 */
export async function reportWarning(
  consoleLabel: string,
  dialog: WarningDialogOptions
): Promise<void> {
  console.warn(consoleLabel);
  try {
    await message(dialog.body, { title: dialog.title, kind: 'warning' });
  } catch (dialogError) {
    console.error('Failed to display warning dialog', dialogError);
  }
}
