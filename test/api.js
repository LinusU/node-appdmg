/* eslint-env mocha */

var appdmg = require('../')
var imageFormat = require('./lib/image-format')
var visuallyVerifyImage = require('./lib/visually-verify-image')

var fs = require('fs')
var path = require('path')
var temp = require('fs-temp')
var assert = require('assert')

var STEPS = 20

function runAppdmg (opts, verify, cb) {
  var progressCalled = 0
  var ee = appdmg(opts)

  ee.on('progress', function () {
    progressCalled++
  })

  ee.on('finish', function () {
    try {
      assert.equal(progressCalled, STEPS * 2)
      assert.equal(imageFormat(opts.target), verify.format)
    } catch (err) {
      return cb(err)
    }

    var expected = path.join(__dirname, verify.visually)
    visuallyVerifyImage(opts.target, verify.title, expected, cb)
  })
}

describe('api', function () {
  var targetDir, targetPath

  beforeEach(function () {
    targetDir = temp.mkdirSync()
    targetPath = path.join(targetDir, 'Test.dmg')
  })

  afterEach(function () {
    fs.unlinkSync(targetPath)
    fs.rmdirSync(path.dirname(targetPath))
  })

  it('creates an image from a modern specification', function (done) {
    this.timeout(60000) // 1 minute

    var opts = {
      target: targetPath,
      source: path.join(__dirname, 'assets', 'appdmg.json')
    }

    var verify = {
      format: 'UDZO',
      title: 'Test Title',
      visually: 'accepted-1.png'
    }

    runAppdmg(opts, verify, done)
  })

  it('creates an image from a legacy specification', function (done) {
    this.timeout(60000) // 1 minute

    var opts = {
      target: targetPath,
      source: path.join(__dirname, 'assets', 'appdmg-legacy.json')
    }

    var verify = {
      format: 'UDZO',
      title: 'Test Title',
      visually: 'accepted-1.png'
    }

    runAppdmg(opts, verify, done)
  })

  it('creates an image from a passed options', function (done) {
    this.timeout(60000) // 1 minute

    var opts = {
      target: targetPath,
      basepath: path.join(__dirname, 'assets'),
      specification: {
        title: 'Test Title',
        icon: 'TestIcon.icns',
        background: 'TestBkg.png',
        'icon-size': 80,
        contents: [
          { x: 448, y: 344, type: 'link', path: '/Applications' },
          { x: 192, y: 344, type: 'file', path: 'TestApp.app' },
          { x: 512, y: 128, type: 'file', path: 'TestDoc.txt' }
        ]
      }
    }

    var verify = {
      format: 'UDZO',
      title: 'Test Title',
      visually: 'accepted-1.png'
    }

    runAppdmg(opts, verify, done)
  })

  it('creates an image without compression', function (done) {
    this.timeout(60000) // 1 minute

    var opts = {
      target: targetPath,
      basepath: path.join(__dirname, 'assets'),
      specification: {
        title: 'Test Title',
        icon: 'TestIcon.icns',
        background: 'TestBkg.png',
        format: 'UDRO',
        'icon-size': 80,
        contents: [
          { x: 448, y: 344, type: 'link', path: '/Applications' },
          { x: 192, y: 344, type: 'file', path: 'TestApp.app' },
          { x: 512, y: 128, type: 'file', path: 'TestDoc.txt' }
        ]
      }
    }

    var verify = {
      format: 'UDRO',
      title: 'Test Title',
      visually: 'accepted-1.png'
    }

    runAppdmg(opts, verify, done)
  })

  it('creates an image with a background color', function (done) {
    this.timeout(60000) // 1 minute

    var opts = {
      target: targetPath,
      source: path.join(__dirname, 'assets', 'appdmg-bg-color.json')
    }

    var verify = {
      format: 'UDZO',
      title: 'Test Title',
      visually: 'accepted-2.png'
    }

    runAppdmg(opts, verify, done)
  })
})
