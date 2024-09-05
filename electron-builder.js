module.exports = {
  appId: 'dev.skydiver.mermaid-desktop',
  productName: 'MermaidJS Desktop Clinet',
  directories: {
    buildResources: 'assets',
  },
  files: [
    '**/*',
    '!node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!node_modules/.bin',
    '!**/node_modules/.bin',
  ],
  extraFiles: ['assets/'],
  mac: {
    category: 'public.app-category.utilities',
    target: [
      {
        target: 'dir', // Build the .app file only
        arch: [
          // 'x64',
          'arm64',
        ], // Specify the architectures you want to build for
      },
    ],
    icon: 'icon.png', // Ensure you have an icon in the ICNS format
  },
  // win: {
  //   target: "nsis",
  //   icon: "assets/icon.ico"
  // },
  // linux: {
  //   target: [
  //     "AppImage",
  //     "deb",
  //     "rpm"
  //   ],
  //   icon: "assets"
  // }
};
