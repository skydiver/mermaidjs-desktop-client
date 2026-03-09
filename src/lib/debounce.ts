export interface DebouncedFunction<TArgs extends unknown[]> {
  (...args: TArgs): void;
  cancel(): void;
}

export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => unknown,
  wait: number
): DebouncedFunction<TArgs> {
  let timeoutId: number | undefined;
  const debounced = (...args: TArgs) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      void fn(...args);
    }, wait);
  };
  debounced.cancel = () => {
    window.clearTimeout(timeoutId);
  };
  return debounced;
}
