'use strict'

const execa = require('execa')
const pathExists = require('path-exists')
const util = require('util')
const xattr = require('fs-xattr')

exports.sh = function (prog, args, cb) {
  util.callbackify(() => execa(prog, args))(cb)
}

exports.dusm = function (path, cb) {
  exports.sh('du', ['-sm', path], (err, res) => {
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
  const buf = Buffer.alloc(32)
  buf.writeUInt8(4, 8)
  util.callbackify(() => xattr.set(path, 'com.apple.FinderInfo', buf))(cb)
}

exports.codesign = function (identity, identifier, path, cb) {
  let args = ['--verbose', '--sign', identity]
  if (identifier) {
    args.push('--identifier', identifier)
  }
  args.push(path)
  exports.sh('codesign', args, (err) => cb(err))
}

exports.pathExists = function (path, cb) {
  util.callbackify(() => pathExists(path))(cb)
}
