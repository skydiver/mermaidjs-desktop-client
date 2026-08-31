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

/** A fenced block that has both an opening and a closing fence. */
interface ClosedBlock {
  /** Lower-cased info string, e.g. `mermaid`, `mmd`, `ts`, or `''`. */
  info: string;
  /** Index of the opening fence line. */
  openLine: number;
  /** Index of the closing fence line. */
  closeLine: number;
}

/** Splits on any line-ending style so fence matching is independent of it. */
function toLines(reply: string): string[] {
  return reply.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

/**
 * Finds every CLOSED fenced block, in order.
 *
 * Scanning stops at an unterminated fence: everything after it is "inside"
 * that block as far as a real Markdown renderer is concerned, so no later
 * fence can open. That rule is what lets a reply still being streamed behave
 * sensibly — a half-written block is simply not a block yet.
 */
function scanClosedBlocks(lines: string[]): ClosedBlock[] {
  const blocks: ClosedBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const openMatch = lines[i].match(FENCE_OPEN_RE);
    if (!openMatch) continue;

    let closeIndex = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (FENCE_CLOSE_RE.test(lines[j])) {
        closeIndex = j;
        break;
      }
    }

    // Unterminated — the rest of the reply belongs to this fence.
    if (closeIndex === -1) break;

    blocks.push({
      info: openMatch[1].trim().toLowerCase(),
      openLine: i,
      closeLine: closeIndex,
    });
    i = closeIndex;
  }

  return blocks;
}

function isMermaid(info: string): boolean {
  return info === 'mermaid' || info === 'mmd';
}

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
  const lines = toLines(reply);
  const mermaidBlocks = scanClosedBlocks(lines).filter((block) => isMermaid(block.info));
  const last = mermaidBlocks[mermaidBlocks.length - 1];
  if (!last) return null;

  return lines
    .slice(last.openLine + 1, last.closeLine)
    .join('\n')
    .trim();
}

/**
 * Removes closed `mermaid`/`mmd` blocks from `reply`, leaving the surrounding
 * prose.
 *
 * The chat bubble renders the reply verbatim AND renders the extracted diagram
 * in its own code box below, so without this the diagram is shown twice — once
 * as raw markup in the sentence flow, once highlighted.
 *
 * Only closed blocks are removed: a block still being streamed has no closing
 * fence yet, and stripping it would make the assistant look like it had stalled
 * mid-reply. It stays visible as text and moves into the code box once the
 * closing fence lands.
 *
 * Other languages' blocks are left alone — they are not duplicated anywhere.
 */
export function stripMermaidBlocks(reply: string): string {
  const lines = toLines(reply);
  const mermaidBlocks = scanClosedBlocks(lines).filter((block) => isMermaid(block.info));
  if (mermaidBlocks.length === 0) return reply.trim();

  const removed = new Set<number>();
  for (const block of mermaidBlocks) {
    for (let i = block.openLine; i <= block.closeLine; i++) removed.add(i);
  }

  return (
    lines
      .filter((_, index) => !removed.has(index))
      .join('\n')
      // Removing a block usually leaves the blank lines that surrounded it
      // back to back; collapse those runs so the prose doesn't gain a gap
      // where the diagram used to be.
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
