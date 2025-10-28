# MermaidJS Desktop Client

MermaidJS Desktop Client is a Tauri-powered editor for creating and exporting [Mermaid](https://mermaid.js.org/) diagrams. It pairs a CodeMirror-based authoring experience with a live preview, file management helpers, and export tooling for PNG and SVG assets.

## Features

- **Live editing** – Write Mermaid syntax with syntax highlighting, line wrapping, and tab indentation.
- **Instant preview** – Debounced rendering keeps the preview in sync while typing, with friendly error feedback when diagrams fail to render.
- **File workflow** – New, open, and save actions integrate with the native filesystem via Tauri dialog and fs plugins.
- **Exports** – Save diagrams as PNG (1× and 2× scale) or SVG with built-in padding, white backgrounds, and aspect-correct scaling.
- **Resizable workspace** – Drag the divider to resize editor/preview panes or double-click to reset.
- **Window persistence** – Window position, size, and maximized state persist between launches.

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

The command above launches both the Vite dev server and the Tauri shell. If you only need the web preview (without the native shell), you can run:

```bash
pnpm dev
```

and open the reported URL in your browser.

## Building

```bash
# Type-check and bundle the frontend
pnpm build

# Produce a production macOS .app bundle
pnpm tauri build
```

## Tooling

- `pnpm clean` – Remove build artifacts (`dist/`, `src-tauri/target/`)
- `pnpm lint:check` – Run Biome checks across the project
- `pnpm lint:fix` – Automatically apply Biome fixes
- `pnpm lint:format` – Format files with Biome

## Project Structure

- `src/` – Frontend source (editor, preview, toolbar, workspace helpers, styles)
- `src-tauri/` – Tauri backend configuration and Rust bootstrap
- `public/` – Static assets served by Vite (if added)

## Acknowledgements

Built with [Tauri 2.x](https://tauri.app/), [Vite](https://vitejs.dev/), [CodeMirror 6](https://codemirror.net/6/), and [Mermaid 11](https://mermaid.js.org/).
