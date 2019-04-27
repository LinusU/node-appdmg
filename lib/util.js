'use strict'

const execa = require('execa')
const fs = require('fs')
const xattr = require('fs-xattr')
const cpFile = fs.copyFile ? null : require('cp-file')
const alloc = require('buffer-alloc')

exports.sh = function (prog, args, cb) {
  execa(prog, args).then(function (result) {
    setImmediate(cb, null, result)
  }).catch(function (err) {
    setImmediate(cb, err)
  })
}

exports.cp = fs.copyFile || function (source, target, cb) {
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
      return cb(new Error(`du -sm: ${res.stderr}`))
    }

    const m = /^([0-9]+)\t/.exec(res.stdout)
    if (m === null) {
      console.log(res.stdout)
      return cb(new Error('du -sm: Unknown error'))
    }

    return cb(null, parseInt(m[1], 10))
  })
}

exports.tiffutil = function (a, b, out, cb) {
  exports.sh('tiffutil', ['-cathidpicheck', a, b, '-out', out], (err) => cb(err))
}

exports.seticonflag = function (path, cb) {
  const buf = alloc(32)
  buf.writeUInt8(4, 8)
  xattr.set(path, 'com.apple.FinderInfo', buf, cb)
}

exports.codesign = function (identity, identifier, path, cb) {
  var args = ['--verbose', '--sign', identity]
  if (identifier) {
    args.push('--identifier', identifier)
  }
  args.push(path)
  exports.sh('codesign', args, function (err) { cb(err) })
}
