/* eslint-env mocha */

'use strict'

const pkg = require('../package.json')

const fs = require('fs')
const path = require('path')
const temp = require('fs-temp')
const assert = require('assert')
const spawnSync = require('child_process').spawnSync

const bin = path.join(__dirname, '..', 'bin', 'appdmg.js')

function bufferContains (buffer, needle) {
  return (buffer.toString().indexOf(needle) !== -1)
}

describe('bin', function () {
  it('should print version number', function () {
    const res = spawnSync(bin, [ '--version' ])

    assert.ok(bufferContains(res.stderr, pkg.version))
  })

  it('should print usage', function () {
    const res = spawnSync(bin, [ '--help' ])

    assert.ok(bufferContains(res.stderr, 'Usage:'))
  })

  it('should create dmg file', function () {
    this.timeout(60000)

    const source = path.join(__dirname, 'assets', 'appdmg.json')
    const targetDir = temp.mkdirSync()
    const targetPath = path.join(targetDir, 'Test.dmg')

    const res = spawnSync(bin, [ source, targetPath ])

    fs.unlinkSync(targetPath)
    fs.rmdirSync(targetDir)

    assert.ok(bufferContains(res.stderr, targetPath))
  })
})
