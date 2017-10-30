'use strict'

const spawnSync = require('child_process').spawnSync

function imageFormat (imagePath) {
  const arg = ['imageinfo', '-format', imagePath]
  const out = spawnSync('hdiutil', arg).stdout

  return out.toString().trim()
}

module.exports = imageFormat
