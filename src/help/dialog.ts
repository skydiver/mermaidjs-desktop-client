import { getName, getVersion } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/plugin-shell';

export function setupHelpDialog(button: HTMLButtonElement | null): void {
  if (!button) return;

  let dialog: HTMLDialogElement | null = null;

  async function createDialog(): Promise<HTMLDialogElement> {
    const [appName, appVersion] = await Promise.all([getName(), getVersion()]);

    const el = document.createElement('dialog');
    el.className = 'help-dialog';
    el.innerHTML = `
      <div class="help-dialog-content">
        <header class="help-dialog-header">
          <h2>${appName} <span class="version">v${appVersion}</span></h2>
          <button type="button" class="help-dialog-close" aria-label="Close">
            <i class="ri-close-line" aria-hidden="true"></i>
          </button>
        </header>
        <div class="help-dialog-body">
          <fieldset class="help-section">
            <legend>About</legend>
            <p class="about-description">Desktop editor for Mermaid diagrams with real-time preview, syntax highlighting, and SVG/PNG export.</p>
            <div class="about-actions">
              <button type="button" class="about-button" data-url="https://github.com/skydiver/mermaidjs-desktop-client">
                <i class="ri-github-fill" aria-hidden="true"></i>
                View Source
              </button>
            </div>
          </fieldset>
          <fieldset class="help-section">
            <legend>Keyboard Shortcuts</legend>
            <div class="shortcut-group">
              <h4>File</h4>
              <dl class="shortcut-list">
                <div class="shortcut-item"><dt><kbd>Cmd</kbd>+<kbd>N</kbd></dt><dd>New diagram</dd></div>
                <div class="shortcut-item"><dt><kbd>Cmd</kbd>+<kbd>O</kbd></dt><dd>Open file</dd></div>
                <div class="shortcut-item"><dt><kbd>Cmd</kbd>+<kbd>S</kbd></dt><dd>Save file</dd></div>
              </dl>
            </div>
            <div class="shortcut-group">
              <h4>Editor Zoom</h4>
              <dl class="shortcut-list">
                <div class="shortcut-item"><dt><kbd>Cmd</kbd>+<kbd>=</kbd></dt><dd>Zoom in</dd></div>
                <div class="shortcut-item"><dt><kbd>Cmd</kbd>+<kbd>-</kbd></dt><dd>Zoom out</dd></div>
                <div class="shortcut-item"><dt><kbd>Cmd</kbd>+<kbd>0</kbd></dt><dd>Reset zoom</dd></div>
              </dl>
            </div>
            <div class="shortcut-group">
              <h4>Preview Zoom</h4>
              <dl class="shortcut-list">
                <div class="shortcut-item"><dt><kbd>Ctrl</kbd>+<kbd>Scroll</kbd></dt><dd>Zoom in/out</dd></div>
              </dl>
            </div>
            <div class="shortcut-group">
              <h4>General</h4>
              <dl class="shortcut-list">
                <div class="shortcut-item"><dt><kbd>F1</kbd></dt><dd>Open help</dd></div>
              </dl>
            </div>
          </fieldset>
          <fieldset class="help-section">
            <legend>Examples</legend>
            <p class="examples-description">Load sample diagrams from the Examples menu in the toolbar to explore different Mermaid diagram types:</p>
            <ul class="examples-list">
              <li>Flowchart</li>
              <li>Class Diagram</li>
              <li>Sequence Diagram</li>
              <li>Entity Relationship</li>
              <li>State Diagram</li>
              <li>Gantt Chart</li>
              <li>Git Graph</li>
            </ul>
          </fieldset>
        </div>
      </div>
    `;

    el.querySelector('.help-dialog-close')?.addEventListener('click', () => {
      el.close();
    });

    el.querySelector('.about-button')?.addEventListener('click', async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const url = button.dataset.url;
      if (url) {
        await open(url);
      }
    });

    el.addEventListener('click', (event) => {
      if (event.target === el) {
        el.close();
      }
    });

    document.body.appendChild(el);
    return el;
  }

  button.addEventListener('click', async () => {
    if (!dialog) {
      dialog = await createDialog();
    }
    dialog.showModal();
  });

  window.addEventListener('keydown', async (event) => {
    if (event.key === 'F1' || (event.key === '?' && (event.metaKey || event.ctrlKey))) {
      event.preventDefault();
      if (!dialog) {
        dialog = await createDialog();
      }
      dialog.showModal();
    }
  });
}
