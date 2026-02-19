/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.carticas.brillantes',
  productName: 'Carticas Aun Mas Brillantes',
  directories: {
    output: 'release',
    buildResources: 'resources'
  },
  files: [
    'out/**/*',
    'package.json'
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true
  },
  linux: {
    target: 'AppImage',
    category: 'Utility'
  },
  mac: {
    target: 'dmg'
  }
}
