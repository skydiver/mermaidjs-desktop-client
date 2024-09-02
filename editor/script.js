document.getElementById('open-file-btn').addEventListener('click', async () => {
  const content = await window.electron.openFile();
  if (content) {
      window.monacoEditor.setValue(content); // Load content into Monaco Editor
  }
});

document.getElementById('save-file-btn').addEventListener('click', async () => {
  const content = window.monacoEditor.getValue(); // Get content from Monaco Editor
  await window.electron.saveFile(content);
});

const resizer = document.getElementById('resizer');
const editorContainer = document.getElementById('editor');
const diagramContainer = document.getElementById('rendered-diagram-container');
const fullScreenBtn = document.getElementById('full-screen-btn');

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

  editorContainer.style.width = `${newEditorWidth}%`;
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
