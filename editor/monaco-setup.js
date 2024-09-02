require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.33.0/min/vs' }});

require(['vs/editor/editor.main'], function () {
  const monacoEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
    value: `graph TD
    A[Client] --> B[Load Balancer]
    B --> C[Server1]
    B --> D[Server2]`,
    language: 'plaintext',
    theme: 'vs-dark',
    automaticLayout: true,
  });

  window.monacoEditor = monacoEditor;

  monacoEditor.onDidChangeModelContent(() => {
    const content = monacoEditor.getValue().trim();
    const diagramElement = document.getElementById('rendered-diagram');
    diagramElement.innerHTML = ''; // Clear the existing diagram
    const diagramDiv = document.createElement('div');
    diagramDiv.className = 'mermaid';
    diagramDiv.textContent = content;
    diagramElement.appendChild(diagramDiv);

    try {
      mermaid.init(undefined, diagramDiv);
    } catch (error) {
      console.error('Mermaid rendering error:', error);
    }
  });

  // Render the initial diagram
  const renderDiagram = () => {
    const content = monacoEditor.getValue().trim();
    const diagramElement = document.getElementById('rendered-diagram');
    diagramElement.innerHTML = '';
    const diagramDiv = document.createElement('div');
    diagramDiv.className = 'mermaid';
    diagramDiv.textContent = content;
    diagramElement.appendChild(diagramDiv);
    try {
      mermaid.init(undefined, diagramDiv);
    } catch (error) {
      console.error('Mermaid rendering error:', error);
    }
  };

  renderDiagram(); // Initial render
});
