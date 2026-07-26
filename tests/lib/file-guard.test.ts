import { describe, expect, it } from 'vitest';
import { isFileTooLarge, looksBinary, MAX_OPEN_FILE_BYTES } from '../../src/lib/file-guard';

describe('isFileTooLarge', () => {
  it('is false for a zero-byte file', () => {
    expect(isFileTooLarge(0)).toBe(false);
  });

  it('is false strictly under the limit', () => {
    expect(isFileTooLarge(MAX_OPEN_FILE_BYTES - 1)).toBe(false);
  });

  it('is false exactly at the limit', () => {
    expect(isFileTooLarge(MAX_OPEN_FILE_BYTES)).toBe(false);
  });

  it('is true just over the limit', () => {
    expect(isFileTooLarge(MAX_OPEN_FILE_BYTES + 1)).toBe(true);
  });

  it('honors a custom limit override', () => {
    expect(isFileTooLarge(100, 50)).toBe(true);
    expect(isFileTooLarge(50, 50)).toBe(false);
  });
});

describe('looksBinary', () => {
  it('is false for ordinary mermaid source', () => {
    expect(looksBinary('flowchart TD\n  A --> B\n  B --> C\n')).toBe(false);
  });

  it('is false for an empty string', () => {
    expect(looksBinary('')).toBe(false);
  });

  it('is true when a NUL byte is present', () => {
    const withNul = `flowchart TD${String.fromCharCode(0)} A --> B\n`;
    expect(looksBinary(withNul)).toBe(true);
  });

  it('is true for content dominated by non-printable control characters', () => {
    const control = Array.from({ length: 200 }, (_, i) => String.fromCharCode((i % 26) + 1)).join(
      ''
    );
    expect(looksBinary(control)).toBe(true);
  });

  it('tolerates a handful of control characters within normal text', () => {
    const text = `flowchart TD\r\n  A --> B\r\n${'x'.repeat(500)}`;
    expect(looksBinary(text)).toBe(false);
  });
});
