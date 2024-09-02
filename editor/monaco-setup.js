require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.33.0/min/vs' }});

require(['vs/editor/editor.main'], function () {
  // Register the MermaidJS language
  monaco.languages.register({ id: 'mermaidjs' });

  // Define the language configuration and tokens
  monaco.languages.setMonarchTokensProvider('mermaidjs', {
    tokenizer: {
      root: [
        [/%%.*/, 'comment'],
        [/\bgraph\b/, 'keyword'],
        [/\bTB\b|\bBT\b|\bRL\b|\bLR\b/, 'keyword'],
        [/\bsubgraph\b/, 'keyword'],
        [/[a-zA-Z_]\w*/, 'identifier'],
        [/\[.*?\]/, 'string'],
        [/-->|-->|\-\-|\-\-/g, 'operator'],
        [/\{|\}|\[|\]/, 'delimiter.bracket'],
        [/\s+/, 'white'],
      ],
    },
  });

  // Define the language configuration
  monaco.languages.setLanguageConfiguration('mermaidjs', {
    brackets: [
      ['{', '}'],
      ['[', ']'],
    ],
  });

  const monacoEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
    value: `graph TD
    A[Client] --> B[Load Balancer]
    B --> C[Server1]
    B --> D[Server2]`,
    language: 'mermaidjs',  // Set language to mermaidjs
    theme: 'vs',
    automaticLayout: true,
    minimap: {
      enabled: false // Disable the minimap
    }
  });

  window.monacoEditor = monacoEditor;

  // Initialize MermaidJS
  mermaid.initialize({ startOnLoad: true });

  // Re-render Mermaid diagram when content changes
  const renderMermaidDiagram = () => {
    const content = monacoEditor.getValue().trim();
    const diagramElement = document.getElementById('rendered-diagram');
    diagramElement.innerHTML = ''; // Clear the existing diagram
    const diagramDiv = document.createElement('div');
    diagramDiv.className = 'mermaid';
    diagramDiv.textContent = content;
    diagramElement.appendChild(diagramDiv);

    try {
      mermaid.contentLoaded(); // Trigger Mermaid to render the diagram
    } catch (error) {
      console.error('Mermaid rendering error:', error);
    }
  };

  monacoEditor.onDidChangeModelContent(renderMermaidDiagram);

  renderMermaidDiagram(); // Initial render
});
