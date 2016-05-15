var spawn = require('child_process').spawn
var xattr = require('fs-xattr')
var cpFile = require('cp-file')

var StringStream = require('./string-stream')

exports.sh = function (prog, args, cb) {
  var outStream = new StringStream()
  var errStream = new StringStream()
  var child = spawn(prog, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.pipe(outStream)
  child.stderr.pipe(errStream)
  child.on('error', function (err) {
    cb(err)
  })
  child.on('exit', function (code) {
    if (code === 0) {
      // FIXME: don't use a stupid setTimeout, ensure pipes are closed...
      setTimeout(function () {
        cb(null, { stdout: outStream.toString(), stderr: errStream.toString() })
      }, 400)
    } else {
      var err = new Error('Error running `' + prog + '`! Exit code was ' + code)
      err.exitCode = code
      err.stdout = outStream.toString()
      err.stderr = errStream.toString()
      cb(err)
    }
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
