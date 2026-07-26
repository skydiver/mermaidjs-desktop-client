// ── Constants ───────────────────────────────────────────

/**
 * Maximum size, in bytes, of a file the Open dialog / drag-drop / file
 * association routes will load without refusing.
 *
 * Mermaid diagram source is plain text and the largest real-world examples
 * (dense ER diagrams, big Gantt charts) top out in the tens-to-low-hundreds
 * of KB. 5 MB is roughly 50,000 lines of typical diagram source — far more
 * than any legitimate diagram, while still small enough that `readTextFile`,
 * CodeMirror's document construction, and a `mermaid.render` pass all stay
 * well under a second. It exists to catch the failure mode in W-11 (a user
 * accidentally opening a multi-hundred-MB log or binary through "All
 * Files"), not to constrain real diagrams.
 */
export const MAX_OPEN_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Number of leading characters of file content inspected by {@link looksBinary}.
 * Large enough to smooth out a handful of legitimate control characters
 * (CRLF line endings, an isolated tab) without requiring the whole file to
 * be scanned.
 */
const BINARY_SAMPLE_SIZE = 2048;

/** Non-printable control characters tolerated in ordinary text: tab, LF, CR. */
const ALLOWED_CONTROL_CHARS = new Set([0x09, 0x0a, 0x0d]);

/** Above this fraction of non-printable characters in the sample, treat the content as binary. */
const BINARY_RATIO_THRESHOLD = 0.05;

// ── Pure predicates (unit-testable) ────────────────────────

/**
 * True when a file's size exceeds the allowed threshold and should be
 * refused (or warned about) rather than loaded into the editor.
 */
export function isFileTooLarge(bytes: number, limit: number = MAX_OPEN_FILE_BYTES): boolean {
  return bytes > limit;
}

/**
 * Heuristic check for binary content that slipped through as "text" (e.g. a
 * file picked via the "All Files" dialog filter). A single NUL byte is a
 * reliable binary signal on its own; otherwise, content is flagged when more
 * than {@link BINARY_RATIO_THRESHOLD} of a leading sample is made up of
 * non-printable control characters other than tab/LF/CR.
 */
export function looksBinary(content: string, sampleSize: number = BINARY_SAMPLE_SIZE): boolean {
  if (content.length === 0) return false;

  const sample = content.slice(0, sampleSize);
  let nonPrintableCount = 0;

  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 0) return true;
    const isControlChar = code < 0x20 || code === 0x7f;
    if (isControlChar && !ALLOWED_CONTROL_CHARS.has(code)) {
      nonPrintableCount++;
    }
  }

  return nonPrintableCount / sample.length > BINARY_RATIO_THRESHOLD;
}
