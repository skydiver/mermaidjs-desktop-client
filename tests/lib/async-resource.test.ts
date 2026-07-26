import { describe, expect, it, vi } from 'vitest';
import { manageAsyncResource } from '../../src/lib/async-resource';

/** A promise plus externally-callable resolve/reject, for controlling timing in tests. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('manageAsyncResource', () => {
  it('releases the handle exactly once when teardown happens after the subscription resolves', async () => {
    const { promise, resolve } = deferred<string>();
    const release = vi.fn();

    const teardown = manageAsyncResource(() => promise, release);

    resolve('handle-1');
    await promise;
    // Let the internal .then callback run.
    await Promise.resolve();

    teardown();
    teardown(); // idempotent — a second teardown call must not double-release

    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith('handle-1');
  });

  it('releases the handle exactly once, once it arrives, when teardown happens before the subscription resolves', async () => {
    const { promise, resolve } = deferred<string>();
    const release = vi.fn();

    const teardown = manageAsyncResource(() => promise, release);

    teardown();
    expect(release).not.toHaveBeenCalled();

    resolve('handle-2');
    await promise;
    await Promise.resolve();

    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith('handle-2');
  });

  it('never releases the handle if teardown is never called', async () => {
    const { promise, resolve } = deferred<string>();
    const release = vi.fn();

    manageAsyncResource(() => promise, release);

    resolve('handle-3');
    await promise;
    await Promise.resolve();

    expect(release).not.toHaveBeenCalled();
  });

  it('reports a rejected subscription without throwing and retains no handle', async () => {
    const { promise, reject } = deferred<string>();
    const release = vi.fn();
    const onSubscribeError = vi.fn();

    const teardown = manageAsyncResource(() => promise, release, onSubscribeError);

    reject(new Error('watch setup failed'));
    await promise.catch(() => {
      // Expected — this test asserts the rejection is handled via onSubscribeError.
    });
    await Promise.resolve();

    expect(onSubscribeError).toHaveBeenCalledTimes(1);
    expect(onSubscribeError.mock.calls[0][0]).toBeInstanceOf(Error);

    // Teardown after a rejection has nothing to release, and must not throw.
    expect(() => teardown()).not.toThrow();
    expect(release).not.toHaveBeenCalled();
  });
});
