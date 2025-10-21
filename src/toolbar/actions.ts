import type { EditorView } from 'codemirror';

import { createExportHandler } from './export-diagram';
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
}
