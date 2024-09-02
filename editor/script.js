import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

const inputElement = document.getElementById('mermaid-input');
const diagramElement = document.getElementById('rendered-diagram');
const resizer = document.getElementById('resizer');
const editor = document.getElementById('editor');
const diagramContainer = document.getElementById('rendered-diagram-container');
const fullScreenBtn = document.getElementById('full-screen-btn');
const openFileBtn = document.getElementById('open-file-btn');
const saveFileBtn = document.getElementById('save-file-btn');

function renderDiagram() {
  const userInput = inputElement.value.trim();
  diagramElement.innerHTML = ''; // Clear the existing diagram
  const diagramDiv = document.createElement('div');
  diagramDiv.className = 'mermaid';
  diagramDiv.textContent = userInput;
  diagramElement.appendChild(diagramDiv);

  try {
    mermaid.init(undefined, diagramDiv);
  } catch (error) {
    console.error('Mermaid rendering error:', error);
  }
}

inputElement.addEventListener('input', renderDiagram);

mermaid.initialize({ startOnLoad: false });

renderDiagram(); // Render the initial diagram

let isResizing = false;

resizer.addEventListener('mousedown', function (e) {
  isResizing = true;
  document.body.style.cursor = 'ew-resize';
});

document.addEventListener('mousemove', function (e) {
  if (!isResizing) return;

  let newEditorWidth = (e.clientX / window.innerWidth) * 100;

  // Set limits for resizing
  if (newEditorWidth < 25) newEditorWidth = 25; // 1/4 of the total width
  if (newEditorWidth > 50) newEditorWidth = 50; // 1/2 of the total width

  let newDiagramWidth = 100 - newEditorWidth;

  editor.style.width = `${newEditorWidth}%`;
  diagramContainer.style.width = `${newDiagramWidth}%`;
});

document.addEventListener('mouseup', function () {
  isResizing = false;
  document.body.style.cursor = 'default';
});

fullScreenBtn.addEventListener('click', function () {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
});

openFileBtn.addEventListener('click', async () => {
  const content = await window.electron.openFile();
  if (content) {
    inputElement.value = content;
    renderDiagram(); // Re-render the diagram with the loaded content
  }
});

saveFileBtn.addEventListener('click', async () => {
  const content = inputElement.value;
  await window.electron.saveFile(content);
});

// Enable the tab key to insert a tab character instead of losing focus
inputElement.addEventListener('keydown', function (e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = this.selectionStart;
    const end = this.selectionEnd;

    // Set textarea value to: text before caret + tab + text after caret
    this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);

    // Put caret at right position again
    this.selectionStart = this.selectionEnd = start + 1;

    // Re-render the diagram
    renderDiagram();
  }
});
