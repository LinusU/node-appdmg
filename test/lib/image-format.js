var spawnSync = require('child_process').spawnSync

function imageFormat (imagePath) {
  var arg = ['imageinfo', '-format', imagePath]
  var out = spawnSync('hdiutil', arg).stdout

  return out.toString().trim()
}

module.exports = imageFormat
