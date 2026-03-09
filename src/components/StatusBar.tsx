export type StatusLevel = 'idle' | 'loading' | 'success' | 'error';

interface StatusBarProps {
  fileName: string | null;
  isDirty: boolean;
  lastSavedAt: Date | null;
  statusMessage: string;
  statusLevel: StatusLevel;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  idle: 'text-neutral-400 dark:text-slate-500',
  loading: 'text-blue-500 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
};

export default function StatusBar({
  fileName,
  isDirty,
  lastSavedAt,
  statusMessage,
  statusLevel,
}: StatusBarProps) {
  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 text-xs dark:border-slate-700 dark:bg-slate-800">
      {/* Left: file info */}
      <div className="flex items-center gap-2 text-neutral-500 dark:text-slate-400">
        {fileName ? (
          <span className="font-medium text-neutral-600 dark:text-slate-300">{fileName}</span>
        ) : (
          <span className="text-neutral-400 dark:text-slate-500">Untitled</span>
        )}
        {isDirty && <span className="text-amber-600 dark:text-amber-400">Modified</span>}
        {lastSavedAt && !isDirty && (
          <span className="text-neutral-400 dark:text-slate-500">
            Saved {formatTime(lastSavedAt)}
          </span>
        )}
      </div>

      {/* Right: render status */}
      <div className={STATUS_COLORS[statusLevel]}>{statusMessage}</div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
