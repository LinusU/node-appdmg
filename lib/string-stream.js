var util = require('util')
var stream = require('stream')

function StringStream () {
  stream.Writable.call(this)
  this.collected = []
}

util.inherits(StringStream, stream.Writable)

StringStream.prototype._write = function (chunk, encoding, cb) {
  this.collected.push(chunk.toString())
  cb(null)
}

StringStream.prototype.toString = function () {
  return this.collected.join('')
}

module.exports = StringStream
