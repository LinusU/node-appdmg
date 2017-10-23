var fs = require('fs')
var temp = require('fs-temp')
var util = require('./util')

exports.convert = function (source, format, target, cb) {
  var args = []
  args.push('convert', source)
  args.push('-ov')
  args.push('-format', format)
  args.push('-imagekey', 'zlib-level=9')
  args.push('-o', target)
  util.sh('hdiutil', args, function (err) {
    if (err) {
      fs.unlink(target, function () {
        cb(err)
      })
    } else {
      cb(null, target)
    }
  })
}

exports.create = function (volname, size, cb) {
  temp.template('%s.dmg').writeFile('', function (err, outname) {
    if (err) return cb(err)

    var args = [
      'create', outname,
      '-ov',
      '-fs', 'HFS+',
      '-size', size,
      '-volname', volname
    ]

    util.sh('hdiutil', args, function (err) {
      if (!err) return cb(null, outname)

      fs.unlink(outname, function () {
        cb(err)
      })
    })
  })
}

exports.attach = function (path, cb) {
  var args = []
  args.push('attach', path)
  args.push('-nobrowse')
  args.push('-noverify')
  args.push('-noautoopen')
  util.sh('hdiutil', args, function (err, res) {
    if (err) return cb(err)

    var m = /Apple_HFS\s+(.*)\s*$/.exec(res.stdout)
    if (m === null) return cb(new Error('Failed to mount image'))

    cb(null, m[1])
  })
}

exports.detach = function (path, cb) {
  var args = []
  args.push('detach', path)
  util.sh('hdiutil', args, function (err) {
    if (err && err.exitCode === 16 && /Resource busy/.test(err.stderr)) {
      setTimeout(function () {
        util.sh('hdiutil', args, function (err) { cb(err) })
      }, 1000)
    } else {
      cb(err)
    }
  })
}
