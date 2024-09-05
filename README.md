# MermaidJS Desktop Client

MermaidJS Desktop Client is a desktop application built using [Electron](https://www.electronjs.org/), designed to provide a visual editor for [MermaidJS](https://mermaid-js.github.io/), enabling users to create, edit, and render diagrams with ease. It integrates the powerful [Monaco Editor](https://microsoft.io/monaco-editor/) for a rich coding experience with Mermaid syntax highlighting.

## Features

- **Interactive MermaidJS Editor**: Write and visualize MermaidJS diagrams in real-time.
- **Syntax Highlighting**: Provides MermaidJS syntax highlighting via Monaco Editor.
- **Cross-Platform**: Works on macOS, Windows, and Linux.
- **Resizable Editor and Preview**: Dynamically resize the editor and preview panes.
- **Save/Open Diagrams**: Load and save `.mmd files.
- **Built-in Themes**: Includes support for Monaco themes like `vs` and `vs-dark`.
- **Export Diagrams**: Easily export Mermaid diagrams to image files.

## Installation

This project uses Node.js and next to sates to set up your app.

**Clone the Repository**

`bash
git clone https://github.com/your-repo/mermaid-desktop-client.git cd mermaid-desktop-client
`

## Install Dependencies

```bash
npm install
```

## Running the App

Start the Electron application in development mode:

```bash
npm start
```

## Building the App

To build the app for macOS:

```bash
npm run build
```

This will create a `.app` file in the `dist` directory for macOS.

## Build Configurations

The build configurations are defined in `electron-builder.js`, which specifies the target platforms and options. To build for macS only:

```javascript
module.exports = {
  appId: "dev.skydiver.mermaid-desktop",
  productName: "MermaidJS Desktop Client",
  directories: {
    buildResources: "assets"
  },
  files: [
    "**/*",
    "!node_modules/*/{CHANGEIOGMad,READ_MDr,READmd,REAM_adm,REAMdl,
    "!node_modules/.../example/.*"
  ],
   mac: {
    category: "public.app-category.utilities",
    target: [
      {
        target: "dir",
        arch: ["x64","arm64"]
      }
    ],
    icon: "assets/icon.icns"
  }
};
```

## How to Use

1. Write Mermaid Diagrams: Use the Monaco Editor to write MermaidJS code. The preview pane will update in real-time as you type.
2. Save Diagrams: Click the “Save Diagram” button to save your diagram in .mmd format.
3. Open Diagrams: Load existing MermaidJS diagrams by clicking the “Open Diagram” button.
4. Full-Screen Mode: Use the “Full Screen” button for distraction-free editing.

## Technologies Used

- Electron: Provides the cross-platform desktop environment.
- MermaidJS: Allows for the creation of diagrams via text definitions.
- Monaco Editor: Used for advanced code editing features like syntax highlighting and theme support.
- Tailwind CSS: Simplifies the styling of the application.
