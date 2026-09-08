import { ExternalLink } from 'lucide-react';

// ── Constants ────────────────────────────────────────────

const GITHUB_URL = 'https://github.com/skydiver/mermaidjs-desktop-client';

// ── Component ─────────────────────────────────────────────

export default function AboutSection() {
  const handleOpenGitHub = async () => {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(GITHUB_URL);
    } catch {
      window.open(GITHUB_URL, '_blank');
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <img src="/app-icon.png" alt="Mermaid Desktop" className="size-16" />
      <h3 className="text-lg font-semibold">Mermaid Desktop</h3>
      <p className="text-sm text-neutral-500 dark:text-slate-400">Version {__APP_VERSION__}</p>
      <p className="text-sm text-neutral-600 dark:text-slate-300">
        A desktop app for Mermaid diagrams
      </p>
      <p className="text-xs text-neutral-400 dark:text-slate-500">
        &copy; {new Date().getFullYear()}
      </p>
      <button
        type="button"
        onClick={handleOpenGitHub}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        <ExternalLink size={14} />
        View on GitHub
      </button>
    </div>
  );
}
