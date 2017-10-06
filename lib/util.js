var execa = require('execa')
var xattr = require('fs-xattr')
var cpFile = require('cp-file')

exports.sh = function (prog, args, cb) {
  execa(prog, args).then(function (result) {
    setImmediate(cb, null, result)
  }).catch(function (err) {
    setImmediate(cb, err)
  })
}

exports.cp = function (source, target, cb) {
  cpFile(source, target).then(function () {
    setImmediate(cb, null)
  }).catch(function (err) {
    setImmediate(cb, err)
  })
}

exports.dusm = function (path, cb) {
  exports.sh('du', ['-sm', path], function (err, res) {
    if (err) return cb(err)

    if (res.stderr.length > 0) {
      return cb(new Error('du -sm: ' + res.stderr))
    }

    var m = /^([0-9]+)\t/.exec(res.stdout)
    if (m === null) {
      console.log(res.stdout)
      return cb(new Error('du -sm: Unknown error'))
    }

    return cb(null, parseInt(m[1], 10))
  })
}

exports.tiffutil = function (a, b, out, cb) {
  exports.sh('tiffutil', ['-cathidpicheck', a, b, '-out', out], function (err) { cb(err) })
}

exports.seticonflag = function (path, cb) {
  var buf = new Buffer(32)
  buf.fill(0)
  buf.writeUInt8(4, 8)
  xattr.set(path, 'com.apple.FinderInfo', buf, cb)
}

exports.codesign = function (identity, path, cb) {
  exports.sh('codesign', ['--verbose', '--sign', identity, path], function (err) { cb(err) })
}
