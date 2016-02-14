/* eslint-env mocha */

var pkg = require('../package.json')

var fs = require('fs')
var path = require('path')
var temp = require('fs-temp')
var assert = require('assert')
var spawnSync = require('child_process').spawnSync

var bin = path.join(__dirname, '..', 'bin', 'appdmg.js')

function bufferContains (buffer, needle) {
  return (buffer.toString().indexOf(needle) !== -1)
}

describe('bin', function () {
  it('should print version number', function () {
    var res = spawnSync(bin, [ '--version' ])

    assert.ok(bufferContains(res.stderr, pkg.version))
  })

  it('should print usage', function () {
    var res = spawnSync(bin, [ '--help' ])

    assert.ok(bufferContains(res.stderr, 'Usage:'))
  })

  it('should create dmg file', function () {
    this.timeout(60000)

    var source = path.join(__dirname, 'assets', 'appdmg.json')
    var targetDir = temp.mkdirSync()
    var targetPath = path.join(targetDir, 'Test.dmg')

    var res = spawnSync(bin, [ source, targetPath ])

    fs.unlinkSync(targetPath)
    fs.rmdirSync(targetDir)

    assert.ok(bufferContains(res.stderr, targetPath))
  })
})
