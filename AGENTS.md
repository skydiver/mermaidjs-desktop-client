# AGENTS.md - MermaidJS Desktop Client

## Project Overview

Cross-platform desktop app for creating Mermaid diagrams with live preview. Built with Tauri 2 (Rust) + TypeScript/Vite frontend.

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **Rust** (latest stable) - required for Tauri
- **pnpm** - package manager (not npm/yarn)
- Platform-specific Tauri dependencies: https://tauri.app/start/prerequisites/

## Git Workflow

- **Main branch**: `master`
- **Release branches**: `release/x.x.x` format
- Keep commits focused and descriptive
- Run `pnpm lint:fix` before committing

## Build & Run

```bash
pnpm install          # Install dependencies
pnpm tauri dev        # Development with hot reload
pnpm tauri build      # Production build (.app/.exe/.deb)
pnpm build            # Frontend-only build
```

## Code Quality

```bash
pnpm lint:check       # Check with Biome
pnpm lint:fix         # Auto-fix issues
pnpm lint:format      # Format code
```

## Code Style (Biome)

- 2-space indentation
- Single quotes
- Trailing commas (all)
- 100-char line width
- No semicolons where optional
- Prefer `const` over `let`, never use `var`

## Architecture

### Frontend (`src/`)

| Directory | Purpose |
|-----------|---------|
| `editor/` | CodeMirror configuration, syntax highlighting, theme |
| `preview/` | Mermaid rendering with debounce |
| `toolbar/` | File operations (new/open/save/export) |
| `workspace/` | Resizable pane management |
| `window/` | Window state persistence |
| `utils/` | Shared utilities |
| `examples/` | Diagram templates (.mmd files) |

Entry point: `src/main.ts`

### Backend (`src-tauri/`)

- `src/lib.rs` - App setup, plugin initialization, window state restoration
- `src/main.rs` - Binary entry point
- `tauri.conf.json` - Tauri configuration

## Key Patterns

### State Management

- **Document state**: Tracked in `main.ts` (`lastCommittedDoc`, `isDocumentDirty`, `currentFilePath`)
- **Window state**: Persisted via Tauri Store plugin
- **Editor state**: Managed by CodeMirror EditorState

### Debouncing

- Preview rendering: 300ms debounce to prevent excessive re-renders
- Window state persistence: 400ms debounce for position/size updates

### Rendering

Preview uses token-based cancellation to handle concurrent renders:
```typescript
const currentToken = ++renderToken
// ... render ...
if (currentToken !== renderToken) return // Cancelled
```

### Toolbar Actions

Each action in `src/toolbar/` follows the pattern:
- Export a setup function that takes dependencies (editor, callbacks)
- Attach event listeners to toolbar buttons
- Handle confirmations for unsaved changes

## Conventions

### File Naming

- Kebab-case for files: `open-diagram.ts`, `examples-menu.ts`
- One module per feature/concern

### Imports

- Use Vite's glob imports for dynamic loading (see `actions.ts`)
- Tauri plugins imported from `@tauri-apps/plugin-*`

### DOM Elements

- Query selectors use specific attributes: `[data-action="new"]`, `[data-menu="examples"]`
- Status messages displayed in `#status-message` footer element

### Error Handling

- Mermaid errors shown in preview container with user-friendly message
- File operation errors caught and can display in status bar

## Tauri Plugins Used

- `@tauri-apps/plugin-dialog` - Native file dialogs
- `@tauri-apps/plugin-fs` - Filesystem read/write
- `@tauri-apps/plugin-store` - Persistent key-value storage

## Security Notes

- Mermaid initialized with `securityLevel: 'strict'`
- File access only through explicit Tauri plugin calls
- No eval or dynamic code execution

## Testing

No test framework currently configured. Consider adding Vitest for frontend tests.

## Dependencies to Know

- **CodeMirror 6**: Modular editor - extensions in `editor/`
- **Mermaid 11**: Diagram renderer - config in `main.ts`
- **RemixIcon**: Icon font - classes like `ri-file-add-line`

## Version Management

Version is defined in TWO places (keep in sync):
- `package.json` → `version`
- `src-tauri/tauri.conf.json` → `version`

Current version: 2.1.0

## Export Specifications

### PNG Export
- **Minimum dimensions**: 512px (1x), 1024px (2x)
- **Padding**: 10px around diagram
- **Background**: White (#ffffff)
- **Scaling**: Auto-scales up if below minimum
- **File suffix**: `@2x` added for 2x exports

### SVG Export
- Raw SVG with normalized viewBox
- Padding: 10px
- Preserves aspect ratio (`xMidYMid meet`)

## Adding New Features

### New Toolbar Action

1. Create `src/toolbar/your-action.ts`
2. Export a setup function: `export function setupYourAction({ editor, ... }) { ... }`
3. Add button to `src/index.html` with `data-action="your-action"`
4. Import and call setup in `src/toolbar/actions.ts`

### New Example Diagram

1. Add `.mmd` file to `src/examples/` with numeric prefix (e.g., `08-mindmap.mmd`)
2. Add menu item in `src/index.html` under `[data-menu="examples"]`
3. Examples are loaded via Vite glob: `import.meta.glob('../examples/*.mmd', { eager: true, query: '?raw' })`

### New Export Format

1. Add format to `ExportFormat` type in `src/toolbar/export-menu.ts`
2. Add menu item in `src/index.html` under `[data-menu="export"]`
3. Handle new format in `src/toolbar/export-diagram.ts` `createExportHandler`

## Troubleshooting

### Common Issues

- **"Cannot find module '@tauri-apps/...'"**: Run `pnpm install`
- **Tauri build fails**: Check Rust toolchain is installed and up to date
- **Preview not rendering**: Check browser console for Mermaid syntax errors
- **Window state not saving**: Check Tauri Store plugin is initialized in `lib.rs`

### Debug Commands

```bash
pnpm tauri dev         # Dev mode with console output
pnpm tauri build --debug   # Debug build with symbols
```

## File Extensions

- `.mmd` - Primary Mermaid diagram extension
- `.mermaid` - Alternative extension (supported in open dialog)
- `.md` - Markdown files (supported in open dialog)
