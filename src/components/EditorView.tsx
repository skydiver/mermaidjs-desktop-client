import { defaultKeymap, history, historyKeymap, indentWithTab, redo } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useSettings } from '../hooks/useSettings';
import { createMermaidLanguage } from '../lib/editor/language';
import {
  createSettingsCompartments,
  createSettingsExtensions,
  reconfigureSettings,
} from '../lib/editor/settings-compartments';

// ── Public handle for parent access ─────────────────────

export interface EditorViewHandle {
  replaceContent(text: string): void;
  getContent(): string;
}

// ── Props ───────────────────────────────────────────────

interface EditorViewProps {
  initialText: string;
  onChange: (text: string) => void;
}

// ── Component ───────────────────────────────────────────

const EditorViewComponent = forwardRef<EditorViewHandle, EditorViewProps>(
  function EditorViewComponent({ initialText, onChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const { settings } = useSettings();
    const compartmentsRef = useRef(createSettingsCompartments());

    useImperativeHandle(ref, () => ({
      replaceContent(text: string) {
        const editor = editorRef.current;
        if (!editor) return;
        const currentText = editor.state.doc.toString();
        if (currentText === text) return;
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: text },
        });
      },
      getContent() {
        return editorRef.current?.state.doc.toString() ?? '';
      },
    }));

    // Initialize CodeMirror once
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const extensions: Extension[] = [
        lineNumbers(),
        history(),
        bracketMatching(),
        indentOnInput(),
        createMermaidLanguage(),
        ...createSettingsExtensions(compartmentsRef.current, settings),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto', padding: '16px' },
          '.cm-content': { padding: '8px 0' },
          '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
        }),
      ];

      const state = EditorState.create({
        doc: initialText,
        extensions,
      });

      const editor = new EditorView({ state, parent: container });
      editorRef.current = editor;

      // Capture-phase listener to fix redo on non-US keyboard layouts
      function onKeyDownCapture(e: KeyboardEvent) {
        if (e.key === 'Dead' && e.code === 'KeyZ' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          redo(editor);
        }
      }
      container.addEventListener('keydown', onKeyDownCapture, true);

      return () => {
        container.removeEventListener('keydown', onKeyDownCapture, true);
        editor.destroy();
        editorRef.current = null;
      };
    }, []);

    // Reconfigure editor when settings change
    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;
      reconfigureSettings(editor, compartmentsRef.current, settings);
    }, [
      settings.editorFontFamily,
      settings.editorFontSize,
      settings.disableLigatures,
      settings.wordWrap,
      settings.showInvisibles,
      settings.indentType,
      settings.indentSize,
      settings.syntaxHighlighting,
    ]);

    return <div ref={containerRef} className="h-full w-full" />;
  }
);

export default EditorViewComponent;
