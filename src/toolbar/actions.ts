import type { EditorView } from 'codemirror';

import { createExportHandler } from './export-diagram';
import { setupExamplesMenu, type ExampleId } from './examples-menu';
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

  setupExamplesMenu({
    button: examplesButton,
    menu: examplesMenu,
    onSelect: (id) => {
      const snippet = EXAMPLE_SNIPPETS[id];
      if (!snippet) return;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: snippet },
      });
      schedulePreviewRender(snippet);
      onPathChange(null);
    },
  });
}

const EXAMPLE_SNIPPETS: Record<ExampleId, string> = {
  flowchart: `graph TD
    A[Start] --> B{Is the diagram clear?}
    B -- Yes --> C[Share with team]
    B -- No --> D[Revise and iterate]
    D --> A`,
  sequence: `sequenceDiagram
    participant User
    participant App
    participant Renderer

    User->>App: Edit Mermaid source
    App->>Renderer: Debounce update
    Renderer->>Renderer: Render preview
    Renderer-->>User: Updated diagram`,
  gantt: `gantt
    title Release roadmap
    dateFormat  YYYY-MM-DD
    section Planning
    Requirements     :done,    req, 2024-01-01, 2024-01-07
    Concepts          :active, concept, 2024-01-08, 3d
    section Execution
    Implementation    :crit,   impl, 2024-01-11, 8d
    Testing           :        test, after impl, 1w
    section Launch
    Docs & Training   :        docs, 2024-02-01, 5d
    Release           :milestone, rel, 2024-02-09, 1d`,
  class: `classDiagram
    class DiagramEditor {
      +load(path)
      +save(path)
      +setContent(text)
      +renderPreview()
    }
    class ExportService {
      +exportPNG(path)
      +exportSVG(path)
    }
    DiagramEditor --> ExportService : uses`,
};
