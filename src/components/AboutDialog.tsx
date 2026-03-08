import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GITHUB_URL = 'https://github.com/skydiver/mermaidjs-desktop-client';

export default function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const handleOpenGitHub = async () => {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(GITHUB_URL);
    } catch {
      window.open(GITHUB_URL, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>MermaidJS Desktop</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1 text-sm">
          <p className="text-neutral-500 dark:text-neutral-400">Version {__APP_VERSION__}</p>
          <p className="text-neutral-600 dark:text-neutral-300">
            Desktop editor for Mermaid diagrams with real-time preview, syntax highlighting, and
            SVG/PNG export.
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
      </DialogContent>
    </Dialog>
  );
}
