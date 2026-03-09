import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'File',
    shortcuts: [
      { keys: '⌘ N', description: 'New diagram' },
      { keys: '⌘ O', description: 'Open file' },
      { keys: '⌘ S', description: 'Save file' },
    ],
  },
  {
    title: 'Editor Zoom',
    shortcuts: [
      { keys: '⌘ =', description: 'Zoom in' },
      { keys: '⌘ -', description: 'Zoom out' },
      { keys: '⌘ 0', description: 'Reset zoom' },
    ],
  },
  {
    title: 'Preview Zoom',
    shortcuts: [{ keys: 'Ctrl + Scroll', description: 'Zoom in/out' }],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: '⌘ ,', description: 'Settings' },
      { keys: 'F1', description: 'Help' },
    ],
  },
];

export default function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-slate-500">
                {group.title}
              </h4>
              <div className="divide-y divide-neutral-200 rounded-lg bg-neutral-50 px-3 dark:divide-slate-700/50 dark:bg-slate-700/30">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.keys} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-neutral-600 dark:text-slate-300">
                      {shortcut.description}
                    </span>
                    <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-neutral-500 dark:bg-slate-800 dark:text-slate-400">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
