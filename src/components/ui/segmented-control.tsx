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
  const activeIndex = options.findIndex((o) => o.value === value);

  return (
    <div
      data-slot="segmented-control"
      className={cn(
        'relative grid rounded-lg bg-muted p-1 shadow-xs',
        className,
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
              : 'text-muted-foreground hover:text-foreground/80',
          )}
        >
          {opt.label}
        </button>
      ))}
      <div
        data-slot="segmented-control-indicator"
        className="absolute inset-y-1 rounded-md bg-background shadow-xs transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          left: 4,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
    </div>
  );
}
