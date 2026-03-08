import { describe, expect, it } from 'vitest';
import { inferBaseName } from '../../../src/lib/export/export-diagram';

describe('inferBaseName', () => {
  it("returns 'diagram' for null path", () => {
    expect(inferBaseName(null)).toBe('diagram');
  });

  it('extracts name without extension', () => {
    expect(inferBaseName('/Users/foo/my-chart.mmd')).toBe('my-chart');
  });

  it('handles paths without extension', () => {
    expect(inferBaseName('/Users/foo/diagram')).toBe('diagram');
  });
});
