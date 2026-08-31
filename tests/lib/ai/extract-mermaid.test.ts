import { describe, expect, it } from 'vitest';
import { extractMermaid, stripMermaidBlocks } from '../../../src/lib/ai/extract-mermaid';

describe('extractMermaid', () => {
  it('returns null when there is no fenced code block', () => {
    expect(extractMermaid('Here is some plain text, no code at all.')).toBeNull();
  });

  it('returns null when a fenced block has no mermaid/mmd info string', () => {
    const reply = ['Here you go:', '```js', 'console.log(1)', '```'].join('\n');
    expect(extractMermaid(reply)).toBeNull();
  });

  it('extracts a single mermaid block, trimmed', () => {
    const reply = [
      'Sure, here is the diagram:',
      '```mermaid',
      '  graph TD',
      '  A --> B',
      '```',
    ].join('\n');
    expect(extractMermaid(reply)).toBe('graph TD\n  A --> B');
  });

  it('extracts a single mmd block', () => {
    const reply = ['```mmd', 'graph TD', 'A --> B', '```'].join('\n');
    expect(extractMermaid(reply)).toBe('graph TD\nA --> B');
  });

  it('is case-insensitive on the info string', () => {
    const reply = ['```Mermaid', 'graph TD', '```'].join('\n');
    expect(extractMermaid(reply)).toBe('graph TD');
  });

  it('returns the content of the LAST mermaid block when there are multiple', () => {
    const reply = [
      '```mermaid',
      'graph TD',
      'A --> B',
      '```',
      'Some commentary in between.',
      '```mermaid',
      'graph TD',
      'C --> D',
      '```',
    ].join('\n');
    expect(extractMermaid(reply)).toBe('graph TD\nC --> D');
  });

  it('ignores non-mermaid blocks when picking the last relevant block', () => {
    const reply = [
      '```mermaid',
      'graph TD',
      'A --> B',
      '```',
      '```js',
      'console.log(1)',
      '```',
    ].join('\n');
    expect(extractMermaid(reply)).toBe('graph TD\nA --> B');
  });

  it('treats an unterminated fence as no block', () => {
    const reply = ['```mermaid', 'graph TD', 'A --> B'].join('\n');
    expect(extractMermaid(reply)).toBeNull();
  });

  it('treats an unterminated fence as consuming the rest of the reply, even a later valid one', () => {
    const reply = [
      '```mermaid',
      'graph TD',
      'unterminated from here on...',
      '```mermaid',
      'nope',
    ].join('\n');
    // The first fence never closes, so the whole rest of the document is
    // "inside" it — the apparent second fence is just content, not a real one.
    expect(extractMermaid(reply)).toBeNull();
  });

  it('handles an info string with trailing whitespace', () => {
    const reply = ['```mermaid   ', 'graph TD', '```'].join('\n');
    expect(extractMermaid(reply)).toBe('graph TD');
  });

  it('handles CRLF line endings', () => {
    const reply = ['```mermaid', 'graph TD', 'A --> B', '```'].join('\r\n');
    expect(extractMermaid(reply)).toBe('graph TD\nA --> B');
  });

  it('does not let backticks nested inside the block content close the fence early', () => {
    const reply = ['```mermaid', 'graph TD', 'A["Use `code` inline"] --> B', '```'].join('\n');
    expect(extractMermaid(reply)).toBe('graph TD\nA["Use `code` inline"] --> B');
  });

  it('trims leading and trailing blank lines from the extracted block', () => {
    const reply = ['```mermaid', '', '  graph TD', '  A --> B', '', '```'].join('\n');
    expect(extractMermaid(reply)).toBe('graph TD\n  A --> B');
  });
});

describe('stripMermaidBlocks', () => {
  it('removes a closed mermaid block and keeps the prose around it', () => {
    const reply = [
      "Here's the flow:",
      '',
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```',
      '',
      'Let me know if you want more detail.',
    ].join('\n');

    expect(stripMermaidBlocks(reply)).toBe(
      "Here's the flow:\n\nLet me know if you want more detail."
    );
  });

  // The streaming case: until the closing fence arrives the block is not a
  // block, and hiding it would look like the assistant had stalled.
  it('leaves an unterminated block visible', () => {
    const reply = ["Here's the flow:", '', '```mermaid', 'graph TD', '  A --> B'].join('\n');
    expect(stripMermaidBlocks(reply)).toBe(reply.trim());
  });

  it('leaves blocks of other languages alone', () => {
    const reply = ['Config:', '```json', '{"a":1}', '```'].join('\n');
    expect(stripMermaidBlocks(reply)).toBe(reply.trim());
  });

  it('removes every mermaid block, not just the last', () => {
    const reply = [
      'First:',
      '```mermaid',
      'graph TD',
      'A --> B',
      '```',
      'Second:',
      '```mmd',
      'graph LR',
      'C --> D',
      '```',
    ].join('\n');

    expect(stripMermaidBlocks(reply)).toBe('First:\nSecond:');
  });

  it('returns an empty string when the reply is nothing but a diagram', () => {
    const reply = '```mermaid\ngraph TD\nA --> B\n```';
    expect(stripMermaidBlocks(reply)).toBe('');
  });

  it('leaves a reply with no code blocks untouched', () => {
    expect(stripMermaidBlocks('Which direction should it flow?')).toBe(
      'Which direction should it flow?'
    );
  });
});
