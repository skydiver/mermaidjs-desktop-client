import { describe, expect, it } from 'vitest';
import { computeExportDimensions, inferBaseName } from '../../../src/lib/export/export-diagram';

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

const PNG_MAX_DIMENSION = 16384;
const PNG_MAX_AREA = 16_777_216;

function assertAspectRatioPreserved(
  inW: number,
  inH: number,
  outW: number,
  outH: number,
  tolerance = 0.01
) {
  const inRatio = inW / inH;
  const outRatio = outW / outH;
  expect(Math.abs(inRatio - outRatio) / inRatio).toBeLessThanOrEqual(tolerance);
}

describe('computeExportDimensions', () => {
  it('clamps a wide, short diagram (3000x100) at scale 1 to fit the platform cap', () => {
    const result = computeExportDimensions(3000, 100, 1);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(PNG_MAX_DIMENSION);
    assertAspectRatioPreserved(3000, 100, result.width, result.height);
  });

  it('clamps a wide, short diagram (3000x100) at scale 2 to fit the platform cap', () => {
    const result = computeExportDimensions(3000, 100, 2);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(PNG_MAX_DIMENSION);
    assertAspectRatioPreserved(3000, 100, result.width, result.height);
  });

  it('clamps a tall, narrow diagram (100x3000) at scale 2 to fit the platform cap', () => {
    const result = computeExportDimensions(100, 3000, 2);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(PNG_MAX_DIMENSION);
    assertAspectRatioPreserved(100, 3000, result.width, result.height);
  });

  it('preserves aspect ratio for a normal, non-extreme diagram', () => {
    const result = computeExportDimensions(800, 450, 2);
    assertAspectRatioPreserved(800, 450, result.width, result.height);
  });

  it('applies the minimum-dimension floor for a small diagram at scale 1 (shortest side >= 512)', () => {
    const result = computeExportDimensions(400, 300, 1);
    expect(Math.min(result.width, result.height)).toBeGreaterThanOrEqual(512);
  });

  it('applies the minimum-dimension floor for a small diagram at scale 2 (shortest side >= 1024)', () => {
    const result = computeExportDimensions(400, 300, 2);
    expect(Math.min(result.width, result.height)).toBeGreaterThanOrEqual(1024);
  });

  it('lets the ceiling win over the floor for an extreme aspect ratio at scale 2', () => {
    // 3000x100 @2x: the floor wants requiredScale = 1024/100 = 10.24, which
    // would blow the long side (3000 * 10.24 = 30720px) past the platform
    // cap. The ceiling must win, so the shortest side ends up well below the
    // usual 1024px floor — that is the documented, deliberate trade-off.
    const result = computeExportDimensions(3000, 100, 2);
    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(PNG_MAX_DIMENSION);
    expect(Math.min(result.width, result.height)).toBeLessThan(1024);
  });

  it('applies the area cap for a large near-square diagram even though each dimension is under the per-axis cap', () => {
    const result = computeExportDimensions(5000, 5000, 1);
    expect(result.width).toBeLessThanOrEqual(PNG_MAX_DIMENSION);
    expect(result.height).toBeLessThanOrEqual(PNG_MAX_DIMENSION);
    // Per-dimension cap alone would allow up to 16384; area cap should be
    // the binding constraint here, pulling it down much further.
    expect(result.width).toBeLessThan(5000);
    expect(result.width * result.height).toBeLessThanOrEqual(PNG_MAX_AREA * 1.001);
    assertAspectRatioPreserved(5000, 5000, result.width, result.height);
  });

  it('never produces a dimension smaller than 1px', () => {
    const result = computeExportDimensions(1, 1, 1);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it('never produces a non-finite dimension for non-finite input', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      for (const result of [
        computeExportDimensions(bad, 100, 1),
        computeExportDimensions(100, bad, 1),
        computeExportDimensions(100, 100, bad),
      ]) {
        expect(Number.isFinite(result.width)).toBe(true);
        expect(Number.isFinite(result.height)).toBe(true);
        expect(Number.isFinite(result.scale)).toBe(true);
        expect(result.width).toBeGreaterThanOrEqual(1);
        expect(result.height).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
