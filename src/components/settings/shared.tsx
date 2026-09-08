// ── Reusable Sub-Components ──────────────────────────────
//
// Shared by every settings section (General, Editor, About, AI) so each
// section's rows look identical without re-declaring the same markup.

export function SubsectionHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-slate-400">
      {title}
    </h3>
  );
}

export function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm font-medium text-neutral-700 dark:text-slate-200">{label}</span>
      </div>
      {children}
    </div>
  );
}
