# MermaidJS Desktop Client

MermaidJS Desktop Client is a desktop editor for [Mermaid](https://mermaid.js.org/) diagrams with real-time preview, syntax highlighting, and SVG/PNG export. Built with Tauri, it pairs a CodeMirror-based authoring experience with a live preview, file management helpers, and zoom controls for both editor and preview.

# Table of Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Getting Started](#getting-started)
4. [Building](#building)
5. [Tooling](#tooling)
6. [Project Structure](#project-structure)
7. [Screenshots](#screenshots)
8. [Acknowledgements](#acknowledgements)

## Features

- **Live editing** – Write Mermaid syntax with syntax highlighting, line wrapping, and tab indentation support.
- **Instant preview** – Debounced rendering (300ms) keeps the preview in sync while typing, with friendly error feedback when diagrams fail to render.
- **File workflow** – New, open, and save actions integrate with the native filesystem via Tauri dialog and fs plugins. Status bar tracks unsaved changes and last saved time.
- **Built-in examples** – Quick-start templates for flowchart, class, sequence, entity-relationship, state, gantt, and git diagrams.
- **Smart exports** – Save diagrams as PNG (1× and 2× scale) or SVG with built-in padding, white backgrounds, and automatic scaling (min 512px for 1×, 1024px for 2×).
- **Keyboard shortcuts** – Standard shortcuts for file operations, editor zoom (Cmd/Ctrl+=/−/0), and help (F1).
- **Editor zoom** – Zoom in/out and reset the code editor font size with keyboard shortcuts.
- **Preview zoom** – Zoom diagrams with Ctrl+Scroll or toolbar controls.
- **Help dialog** – Press F1 to view app info, keyboard shortcuts, and available diagram examples.
- **Resizable workspace** – Drag the divider to resize editor/preview panes or double-click to reset.
- **Window persistence** – Window position, size, and maximized state persist between launches via Tauri store plugin.

## Prerequisites

Make sure the common Tauri requirements are installed:

- [Node.js](https://nodejs.org/) 18 or newer
- [pnpm](https://pnpm.io/) (preferred package manager for this repo)
- [Rust toolchain](https://www.rust-lang.org/learn/get-started) with `cargo`
- Platform-specific dependencies listed in the [Tauri docs](https://tauri.app/v1/guides/getting-started/prerequisites/) (e.g., Xcode Command Line Tools on macOS)

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the desktop app with live reload
pnpm tauri dev
```

The command above launches both the Vite dev server and the Tauri shell. For faster iteration on UI/preview features without native APIs, you can run the frontend standalone:

```bash
pnpm dev
```

and open the reported URL (typically `http://localhost:5173`) in your browser.

## Building

```bash
# Type-check and bundle the frontend
pnpm build

# Produce a platform-specific production bundle
# Creates .app on macOS, .exe installer on Windows, or .deb/.AppImage on Linux
pnpm tauri build
```

## Tooling

- `pnpm clean` – Remove build artifacts (`dist/`, `src-tauri/target/`)
- `pnpm lint` – Run [Biome](https://biomejs.dev/) linter and formatter checks
- `pnpm lint:fix` – Automatically apply Biome fixes
- `pnpm typecheck` – Type-check TypeScript without emitting files

## Project Structure

- `src/` – Frontend source (TypeScript/Vite)
  - `editor/` – CodeMirror configuration (language support, theme, zoom)
  - `preview/` – Mermaid rendering logic and zoom controls
  - `toolbar/` – File operations, export handlers, examples menu
  - `workspace/` – Resizable pane management
  - `window/` – Persistence layer for window state
  - `help/` – Help dialog with shortcuts and app info
  - `examples/` – Built-in Mermaid diagram templates
- `src-tauri/` – Tauri backend (Rust) with plugins for dialog, filesystem, store, and shell
- `public/` – Static assets served by Vite (if added)

## Screenshots

<p align="center">
  <img src="https://i.imgur.com/CJz8cVo.png" alt="Editor and preview workspace" width="30%" />
  <img src="https://i.imgur.com/pn6gfKd.png" alt="Example diagrams menu" width="30%" />
  <img src="https://i.imgur.com/UJt3kFq.png" alt="Export options" width="30%" />
</p>

## Acknowledgements

Built with [Tauri 2](https://tauri.app/) (v2.9+), [Vite 7](https://vitejs.dev/), [CodeMirror 6](https://codemirror.net/6/), [Mermaid 11](https://mermaid.js.org/) (v11.12+), and [Biome](https://biomejs.dev/) for linting/formatting.
