import { describe, expect, it } from 'vitest';
import { createMermaidLanguage } from '../../../src/lib/editor/language';

describe('createMermaidLanguage', () => {
  it('returns a CodeMirror extension', () => {
    const ext = createMermaidLanguage();
    expect(ext).toBeDefined();
  });
});
