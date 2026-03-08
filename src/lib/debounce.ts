export function debounce<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  wait: number
): (...args: TArgs) => void {
  let timeoutId: number | undefined;
  return (...args: TArgs) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      void fn(...args);
    }, wait);
  };
}
