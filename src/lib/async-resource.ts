// ── Async resource lifecycle helper ────────────────────────

/**
 * Manages a resource created by an async `subscribe()` call (e.g. an OS file
 * watcher or an event listener) whose handle may not exist yet when teardown
 * happens.
 *
 * React effect cleanup runs synchronously, but `subscribe()` resolves later.
 * A naive `handle?.()` in cleanup is a no-op if `subscribe()` hasn't resolved
 * yet, silently orphaning the eventual handle for the lifetime of the
 * process. This helper closes that race: if teardown occurs before
 * `subscribe()` resolves, the resulting handle is released immediately once
 * it arrives instead of being retained forever.
 *
 * Returns a synchronous teardown function suitable for use directly as (or
 * inside) a React effect cleanup function — cleanup functions cannot be
 * async, so the await/release happens internally via `.then`.
 *
 * If `subscribe()` rejects, the rejection is reported via `onSubscribeError`
 * (defaulting to `console.error`) and no handle is retained — the rejection
 * is never left unhandled.
 */
export function manageAsyncResource<T>(
  subscribe: () => Promise<T>,
  release: (handle: T) => void,
  onSubscribeError: (error: unknown) => void = (error) => {
    console.error('Async resource subscription failed:', error);
  }
): () => void {
  let torndown = false;
  let handle: T | undefined;

  subscribe().then(
    (resolved) => {
      if (torndown) {
        release(resolved);
      } else {
        handle = resolved;
      }
    },
    (error) => {
      onSubscribeError(error);
    }
  );

  return () => {
    torndown = true;
    if (handle !== undefined) {
      release(handle);
      handle = undefined;
    }
  };
}
