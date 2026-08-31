// ── Fenced code block extraction ───────────────────────

// Matches a fence-opening line: three backticks, an optional info string,
// and nothing else on the line (trailing whitespace allowed). Anchored with
// `^`/`$` per-line rather than `/m` across the whole reply, since fences are
// scanned line-by-line below to correctly treat an unterminated fence as
// consuming the rest of the document.
const FENCE_OPEN_RE = /^```(\S*)[ \t]*$/;
// A closing fence is a line that is only backticks (at least three) — this
// intentionally does NOT match backticks that appear mid-line (inline code
// spans like `` `foo` `` inside the block content), only a line consisting
// solely of backtick characters.
const FENCE_CLOSE_RE = /^`{3,}[ \t]*$/;

/**
 * Extracts the content of the LAST fenced code block in `reply` whose info
 * string is `mermaid` or `mmd` (case-insensitive), trimmed. Returns `null`
 * when no such block exists.
 *
 * An unterminated fence (opened but never closed) is treated as consuming
 * the rest of the reply — nothing after it can start a new fence, matching
 * how a real Markdown renderer would treat it (everything after is "inside"
 * the unclosed block, so no further complete block can be found).
 */
export function extractMermaid(reply: string): string | null {
  // Normalize CRLF/CR to LF before splitting so fence lines match regardless
  // of the reply's line-ending style.
  const lines = reply.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let lastMatch: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const openMatch = lines[i].match(FENCE_OPEN_RE);
    if (!openMatch) continue;

    const info = openMatch[1].trim().toLowerCase();

    let closeIndex = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (FENCE_CLOSE_RE.test(lines[j])) {
        closeIndex = j;
        break;
      }
    }

    if (closeIndex === -1) {
      // Unterminated — the rest of the reply is inside this fence, so
      // scanning stops here entirely.
      break;
    }

    if (info === 'mermaid' || info === 'mmd') {
      lastMatch = lines
        .slice(i + 1, closeIndex)
        .join('\n')
        .trim();
    }

    i = closeIndex;
  }

  return lastMatch;
}
