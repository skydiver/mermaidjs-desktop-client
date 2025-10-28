export function debounce<T extends (...args: any[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;
  return (...args: Parameters<T>) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      void fn(...args);
    }, wait);
  };
}
