interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const activeIndex = options.findIndex((o) => o.value === value);

  return (
    <div
      className="relative grid rounded-lg bg-neutral-200/70 p-1 dark:bg-neutral-700/70"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`relative z-10 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
      <div
        className="absolute inset-y-1 rounded-md bg-white shadow-sm transition-transform duration-200 ease-out dark:bg-neutral-600"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          left: 4,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
    </div>
  );
}
