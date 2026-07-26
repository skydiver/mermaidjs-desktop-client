import { describe, expect, it } from 'vitest';
import { formatErrorMessage, shouldReportWatchFailure } from '../../src/lib/error-reporting';

describe('formatErrorMessage', () => {
  it('appends an Error instance message', () => {
    expect(formatErrorMessage('Could not save.', new Error('disk full'))).toBe(
      'Could not save.\n\ndisk full'
    );
  });

  it('stringifies non-Error values', () => {
    expect(formatErrorMessage('Could not save.', 'permission denied')).toBe(
      'Could not save.\n\npermission denied'
    );
  });

  it('falls back to a generic reason for nullish errors', () => {
    expect(formatErrorMessage('Could not save.', undefined)).toBe(
      'Could not save.\n\nUnknown error'
    );
  });
});

describe('shouldReportWatchFailure', () => {
  it('reports the first failure for a path', () => {
    expect(shouldReportWatchFailure('/tmp/a.mmd', null)).toBe(true);
  });

  it('suppresses a repeat failure for the same path', () => {
    expect(shouldReportWatchFailure('/tmp/a.mmd', '/tmp/a.mmd')).toBe(false);
  });

  it('reports a failure for a different path even if one was already reported', () => {
    expect(shouldReportWatchFailure('/tmp/b.mmd', '/tmp/a.mmd')).toBe(true);
  });
});
