import { cn } from '@/lib/utils';

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  // `findIndex` returns -1 when `value` matches no option — a persisted
  // setting outside the option set, say. Left unguarded that becomes
  // `translateX(-100%)` and the pill animates outside its own container, so
  // the indicator is hidden instead of mispositioned.
  const activeIndex = options.findIndex((o) => o.value === value);
  const hasActiveOption = activeIndex >= 0;

  return (
    <div
      data-slot="segmented-control"
      className={cn(
        'relative grid rounded-lg bg-muted dark:bg-slate-700/50 p-1 shadow-xs',
        className
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          data-slot="segmented-control-item"
          data-state={value === opt.value ? 'active' : 'inactive'}
          onClick={() => onChange(opt.value)}
          className={cn(
            'relative z-10 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === opt.value
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/80'
          )}
        >
          {opt.label}
        </button>
      ))}
      <div
        data-slot="segmented-control-indicator"
        className="absolute inset-y-1 rounded-md bg-background dark:bg-slate-900 shadow-xs transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          left: 4,
          transform: `translateX(${Math.max(0, activeIndex) * 100}%)`,
          visibility: hasActiveOption ? undefined : 'hidden',
        }}
      />
    </div>
  );
}
