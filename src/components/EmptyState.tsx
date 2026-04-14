import { Workflow } from 'lucide-react';

interface EmptyStateProps {
  isDragOver?: boolean;
}

export default function EmptyState({ isDragOver = false }: EmptyStateProps) {
  return (
    <div
      className={`flex min-h-0 flex-1 items-center justify-center transition-colors ${
        isDragOver ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-white dark:bg-slate-900'
      }`}
    >
      <div
        className={`flex flex-col items-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors ${
          isDragOver
            ? 'border-blue-400 dark:border-blue-500'
            : 'border-neutral-300 dark:border-slate-600'
        }`}
      >
        <Workflow
          className={`h-12 w-12 transition-colors ${
            isDragOver ? 'text-blue-400 dark:text-blue-500' : 'text-neutral-300 dark:text-slate-600'
          }`}
        />
        <div className="text-center">
          <p
            className={`text-sm font-medium transition-colors ${
              isDragOver
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-neutral-600 dark:text-slate-300'
            }`}
          >
            Drop a .mmd file here
          </p>
          <p className="mt-1 text-xs text-neutral-400 dark:text-slate-500">
            Create new · Open from toolbar
          </p>
        </div>
      </div>
    </div>
  );
}
