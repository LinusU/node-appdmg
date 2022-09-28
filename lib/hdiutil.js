'use strict'

const fs = require('fs')
const temp = require('fs-temp')
const util = require('./util')

exports.convert = function (source, format, target, cb) {
  const args = [
    'convert', source,
    '-ov',
    '-format', format,
    '-imagekey', 'zlib-level=9',
    '-o', target
  ]

  util.sh('hdiutil', args, function (err) {
    if (err) {
      fs.unlink(target, () => cb(err))
    } else {
      cb(null, target)
    }
  })
}

exports.create = function (volname, size, cb) {
  temp.template('%s.dmg').writeFile('', function (err, outname) {
    if (err) return cb(err)

    const args = [
      'create', outname,
      '-ov',
      '-fs', 'HFS+',
      '-size', size,
      '-volname', volname
    ]

    util.sh('hdiutil', args, function (err) {
      if (!err) return cb(null, outname)

      fs.unlink(outname, () => cb(err))
    })
  })
}

exports.attach = function (path, cb) {
  const args = [
    'attach', path,
    '-nobrowse',
    '-noverify',
    '-noautoopen'
  ]

  util.sh('hdiutil', args, function (err, res) {
    if (err) return cb(err)

    const m = /Apple_HFS\s+(.*)\s*$/.exec(res.stdout)
    if (m === null) return cb(new Error('Failed to mount image'))

    cb(null, m[1])
  })
}

exports.detach = function (path, cb) {
  const args = ['detach', path]

  let attempts = 0
  function attemptDetach (err) {
    attempts += 1
    if (err && (err.exitCode === 16 || err.code === 16) && attempts <= 8) {
      setTimeout(function () {
        util.sh('hdiutil', args, attemptDetach)
      }, 1000 * Math.pow(2, attempts - 1))
    } else {
      cb(err)
    }
  }

  util.sh('hdiutil', args, attemptDetach)
}
