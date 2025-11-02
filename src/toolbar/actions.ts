import { ask } from '@tauri-apps/plugin-dialog';
import type { EditorView } from 'codemirror';
import { type ExampleItem, setupExamplesMenu } from './examples-menu';
import { createExportHandler } from './export-diagram';
import { setupExportMenu } from './export-menu';
import { setupNewDiagramAction } from './new-diagram';
import { setupOpenDiagramAction } from './open-diagram';
import { setupSaveDiagramAction } from './save-diagram';

const EXAMPLES = loadExamples();

export interface ToolbarActionsOptions {
  editor: EditorView;
  schedulePreviewRender: (doc: string) => void;
  newDiagramButton: HTMLButtonElement | null;
  openButton: HTMLButtonElement | null;
  saveButton: HTMLButtonElement | null;
  exportButton: HTMLButtonElement | null;
  exportMenu: HTMLDivElement | null;
  examplesButton: HTMLButtonElement | null;
  examplesMenu: HTMLDivElement | null;
  isDirty: () => boolean;
  commitDocument: (doc: string, options?: { saved?: boolean }) => void;
  onPathChange: (path: string | null) => void;
  getPath: () => string | null;
  defaultSnippet: string;
}

export function setupToolbarActions(options: ToolbarActionsOptions): void {
  const {
    editor,
    schedulePreviewRender,
    newDiagramButton,
    openButton,
    saveButton,
    exportButton,
    exportMenu,
    examplesButton,
    examplesMenu,
    isDirty,
    commitDocument,
    onPathChange,
    getPath,
    defaultSnippet,
  } = options;

  setupNewDiagramAction({
    editor,
    schedulePreviewRender,
    button: newDiagramButton,
    defaultSnippet,
    onPathChange,
    shouldReplace: async () => {
      if (!isDirty()) {
        return true;
      }
      return confirmReplace('Overwrite the current diagram with a blank template?');
    },
    onNew(doc) {
      commitDocument(doc);
    },
  });

  setupOpenDiagramAction({
    editor,
    schedulePreviewRender,
    button: openButton,
    onPathChange,
    shouldReplace: async () => {
      if (!isDirty()) {
        return true;
      }
      return confirmReplace('Replace the current diagram with the selected file?');
    },
    onOpen(doc) {
      commitDocument(doc);
    },
  });

  setupSaveDiagramAction({
    editor,
    button: saveButton,
    getPath,
    onPathChange,
    onSave(doc) {
      commitDocument(doc, { saved: true });
    },
  });

  const handleExport = createExportHandler({
    editor,
    getPath,
  });

  setupExportMenu({
    button: exportButton,
    menu: exportMenu,
    onSelect: handleExport,
  });

  if (EXAMPLES.length > 0) {
    setupExamplesMenu({
      button: examplesButton,
      menu: examplesMenu,
      items: EXAMPLES,
      onSelect: async (content) => {
        if (isDirty()) {
          const proceed = await confirmReplace('Replace the current diagram with this example?');
          if (!proceed) {
            return;
          }
        }
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: content },
        });
        schedulePreviewRender(content);
        onPathChange(null);
      },
    });
  }
}

function loadExamples(): ExampleItem[] {
  const modules = import.meta.glob('../examples/*.mmd', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  return Object.entries(modules)
    .map(([path, content]) => {
      const match = path.match(/\/([^/]+)\.mmd$/);
      const id = match?.[1];
      if (!id) return null;
      const { order, name } = parseExampleId(id);
      return {
        id: name,
        label: formatExampleLabel(name),
        content,
        order,
      };
    })
    .filter((item): item is ExampleItem => item !== null)
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.label.localeCompare(b.label);
    });
}

function formatExampleLabel(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function parseExampleId(rawId: string): { name: string; order: number } {
  const [, orderPart, namePart] = rawId.match(/^(\d+)[-_](.+)$/) ?? [];
  if (orderPart && namePart) {
    return {
      name: namePart,
      order: Number.parseInt(orderPart, 10),
    };
  }
  return { name: rawId, order: Number.MAX_SAFE_INTEGER };
}

async function confirmReplace(message: string): Promise<boolean> {
  try {
    const result = await ask(message, {
      title: 'Discard unsaved changes?',
      kind: 'warning',
    });
    return result;
  } catch (error) {
    console.warn('Unable to show confirmation dialog', error);
    // Fail-safe: prevent destructive action if dialog fails
    return false;
  }
}
