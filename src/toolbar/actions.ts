import type { EditorView } from 'codemirror';

import { createExportHandler } from './export-diagram';
import { setupExamplesMenu, type ExampleItem } from './examples-menu';

const EXAMPLES = loadExamples();
import { setupExportMenu } from './export-menu';
import { setupNewDiagramAction } from './new-diagram';
import { setupOpenDiagramAction } from './open-diagram';
import { setupSaveDiagramAction } from './save-diagram';

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
  });

  setupOpenDiagramAction({
    editor,
    schedulePreviewRender,
    button: openButton,
    onPathChange,
  });

  setupSaveDiagramAction({
    editor,
    button: saveButton,
    getPath,
    onPathChange,
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
      onSelect: (content) => {
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
    as: 'raw',
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
