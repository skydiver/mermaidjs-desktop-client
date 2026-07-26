# Mermaid Desktop

A desktop editor for [Mermaid](https://mermaid.js.org/) diagrams. Write markup with syntax highlighting, see it render in real time, and export to SVG or PNG.

Built with [Tauri 2](https://tauri.app/), [React 19](https://react.dev/), [CodeMirror 6](https://codemirror.net/), and [Mermaid 11](https://mermaid.js.org/).

<table align="center">
  <tr>
    <td align="center">
      <img src=".github/assets/screenshot-empty.png" alt="Empty state" width="100%" />
      <br><sub>Drop files or create from scratch</sub>
    </td>
    <td align="center">
      <img src=".github/assets/screenshot-er-diagram.png" alt="ER diagram editing" width="100%" />
      <br><sub>Real-time preview for complex diagrams</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src=".github/assets/screenshot-flowchart.png" alt="Flowchart editing" width="100%" />
      <br><sub>Live editing with syntax highlighting</sub>
    </td>
    <td align="center">
      <img src=".github/assets/screenshot-settings.png" alt="Settings dialog" width="100%" />
      <br><sub>Fully configurable editor</sub>
    </td>
  </tr>
</table>

---

## Features

### Editor

- **Syntax highlighting** for Mermaid keywords, arrows, strings, comments, and brackets
- **Live preview** — see your diagram update as you type
- Configurable **font family** (auto-detected system monospace fonts), **font size**, **ligatures**, **indent style**, **word wrap**, and **whitespace visibility** — all applied live

### Canvas Preview

- **Scroll to zoom** — smooth, cursor-anchored (no modifier key required)
- **Drag to pan** — click and drag anywhere on the canvas
- **Fit to viewport** — auto-fits on render; manual fit, reset, and step zoom via toolbar
- **Diagram theme** — independent light/dark/system setting, separate from the app theme

### File Management

- **New / Open / Save / Save As** with native file dialogs
- **Auto-save** — optional, saves automatically while you work
- **External file watch** — detects changes made outside the app; auto-reloads if clean, prompts if dirty
- **Drag and drop** — drop `.mmd`, `.mermaid`, or `.md` files to open
- **File associations** — registered as editor for `.mmd` and `.mermaid`

### Export

| Format  | Details                                                   |
| ------- | --------------------------------------------------------- |
| SVG     | Normalized with explicit `width`, `height`, and `viewBox` |
| PNG     | Minimum 512px on shortest side, themed background         |
| PNG @2x | 2x scale, minimum 1024px, `@2x` filename suffix           |

### Built-in Examples

Seven starter diagrams: Flowchart, Class, Sequence, Entity Relationship, State, Gantt, and Git Graph.

### App

- **Themes** — Light, Dark, or System for both app chrome and diagram rendering
- **Resizable split pane** — 40/60 default, drag to resize, double-click to reset
- **Window state persistence** — size, position, and preferences saved between sessions
- **Keyboard shortcuts**:

| Shortcut          | Action      |
| ----------------- | ----------- |
| Cmd/Ctrl + N      | New diagram |
| Cmd/Ctrl + O      | Open file   |
| Cmd/Ctrl + S      | Save        |
| Cmd/Ctrl + ,      | Settings    |
| Cmd/Ctrl + ? / F1 | Help        |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/)
- [Rust toolchain](https://www.rust-lang.org/learn/get-started)
- Platform-specific dependencies per the [Tauri prerequisites](https://tauri.app/start/prerequisites/)

### Development

```bash
# Install dependencies
pnpm install

# Run the app with live reload
pnpm tauri dev
```

### Production Build

```bash
pnpm tauri build
# Produces a platform-specific bundle (.app, .msi, .deb, etc.)
# Output: src-tauri/target/release/bundle/
```

On macOS, a convenience script builds and copies the `.app` into a top-level `dist/` folder so you don't have to dig into the Cargo target directory:

```bash
pnpm dist
# Output: dist/Mermaid Desktop.app
```

> **Note:** `pnpm dist` wipes the `dist/` folder on each run, and Vite also uses `dist/` as its frontend output directory. Running `pnpm build` or `pnpm tauri build` after `pnpm dist` will overwrite the `.app` with Vite's frontend bundle — re-run `pnpm dist` to regenerate.

---

## Scripts

| Command            | Description                                 |
| ------------------ | ------------------------------------------- |
| `pnpm tauri dev`   | Run the app with live reload                |
| `pnpm tauri build` | Production build (platform-specific bundle) |
| `pnpm dist`        | macOS: build and copy `.app` into `dist/`   |
| `pnpm test`        | Run tests                                   |
| `pnpm lint`        | Lint and format check                       |

---

## Tech Stack

|              |                          |
| ------------ | ------------------------ |
| **Runtime**  | Tauri 2 (Rust + WebView) |
| **Frontend** | React 19, TypeScript 7   |
| **Build**    | Vite 8                   |
| **Styling**  | Tailwind CSS 4, Radix UI |
| **Editor**   | CodeMirror 6             |
| **Diagrams** | Mermaid 11 + ZenUML      |
| **Linting**  | Biome                    |
| **Testing**  | Vitest                   |

---

## License

MIT
