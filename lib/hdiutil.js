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

  util.sh('hdiutil', args, function (err) {
    if (err && err.exitCode === 16 && /Resource busy/.test(err.stderr)) {
      setTimeout(function () {
        util.sh('hdiutil', args, (err) => cb(err))
      }, 1000)
    } else {
      cb(err)
    }
  })
}
