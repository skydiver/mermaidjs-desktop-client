import { FileCode, Info, Settings as SettingsIcon, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useSettings } from '../hooks/useSettings';
import AboutSection from './settings/AboutSection';
import AiSection from './settings/AiSection';
import EditorSection from './settings/EditorSection';
import GeneralSection from './settings/GeneralSection';

// ── Constants ────────────────────────────────────────────

const SECTIONS = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'editor', label: 'Editor', icon: FileCode },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'about', label: 'About', icon: Info },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

// ── Props ────────────────────────────────────────────────

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SectionId;
}

// ── Main Component ───────────────────────────────────────

export default function SettingsDialog({
  open,
  onOpenChange,
  initialSection,
}: SettingsDialogProps) {
  const { resetSettings } = useSettings();
  const [section, setSection] = useState<SectionId>(initialSection ?? 'general');
  const [confirmReset, setConfirmReset] = useState(false);

  // Reset to initialSection when dialog opens
  useEffect(() => {
    if (open) {
      setSection(initialSection ?? 'general');
      setConfirmReset(false);
    }
  }, [open, initialSection]);

  // Auto-dismiss confirmation after 3 seconds
  useEffect(() => {
    if (!confirmReset) return;
    const timer = setTimeout(() => setConfirmReset(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      {open && <div className="fixed inset-x-0 bottom-0 top-10 z-50 bg-black/70" />}
      <DialogContent
        className="sm:max-w-4xl p-0 shadow-2xl"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <div className="flex h-[600px] overflow-hidden rounded-lg">
          {/* Sidebar */}
          <aside className="flex w-44 flex-col border-r border-neutral-200 dark:border-slate-700 dark:bg-slate-900">
            <nav className="flex-1 space-y-1 p-2">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    section === id
                      ? 'bg-neutral-200 text-neutral-900 dark:bg-slate-700 dark:text-slate-100'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>
            <div className="border-t border-neutral-200 p-2 dark:border-slate-700">
              {confirmReset ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetSettings();
                      setConfirmReset(false);
                    }}
                    className="flex-1 rounded-md px-3 py-1.5 text-xs text-red-700 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 rounded-md px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-700/50"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="w-full rounded-md px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
                >
                  Reset to defaults
                </button>
              )}
            </div>
          </aside>

          {/* Main content */}
          <main className="flex flex-1 flex-col bg-neutral-100 dark:bg-slate-900/50">
            <header className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-slate-700">
              <h2 className="font-semibold">{SECTIONS.find((s) => s.id === section)?.label}</h2>
              <DialogClose asChild>
                <button
                  type="button"
                  className="rounded-md p-1 opacity-70 transition-all hover:bg-neutral-200 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus:outline-hidden dark:hover:bg-slate-700"
                >
                  <X size={16} />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </header>
            <div className="flex flex-1 flex-col overflow-y-auto p-4">
              {section === 'general' && <GeneralSection />}
              {section === 'editor' && <EditorSection />}
              {section === 'ai' && <AiSection />}
              {section === 'about' && <AboutSection />}
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
