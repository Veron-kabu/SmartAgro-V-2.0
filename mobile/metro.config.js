// Custom Metro configuration for Expo
// Collapses Hermes InternalBytecode frames to avoid ENOENT reads
const { getDefaultConfig } = require('expo/metro-config')

/** @type {import('metro-config').ConfigT} */
const config = getDefaultConfig(__dirname)

config.symbolicator = {
  customizeFrame(frame) {
    if (frame && typeof frame.file === 'string' && frame.file.endsWith('InternalBytecode.js')) {
      // Hide frames referencing the Hermes internal bytecode pseudo-file
      return { ...frame, collapse: true }
    }
    return frame
  },
}

module.exports = config
