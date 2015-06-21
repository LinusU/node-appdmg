var appdmg = require('../')
var imageFormat = require('./lib/image-format')
var visuallyVerifyImage = require('./lib/visually-verify-image')

var fs = require('fs')
var path = require('path')
var temp = require('fs-temp')
var assert = require('assert')

var STEPS = 20

describe('appdmg', function () {
  var targetDir, targetPath

  beforeEach(function () {
    targetDir = temp.mkdirSync()
    targetPath = path.join(targetDir, 'Test.dmg')
  })

  afterEach(function () {
    fs.unlinkSync(targetPath)
    fs.rmdirSync(path.dirname(targetPath))
  })

  it('creates an image from a specification', function (done) {
    this.timeout(60000) // 1 minute

    var progressCalled = 0
    var ee = appdmg({
      source: path.join(__dirname, 'assets', 'appdmg.json'),
      target: targetPath
    })

    ee.on('progress', function () {
      progressCalled++
    })

    ee.on('finish', function () {
      assert.equal(progressCalled, STEPS * 2)
      assert.equal(imageFormat(targetPath), 'UDZO')

      var expected = path.join(__dirname, 'accepted-1.png')
      visuallyVerifyImage(targetPath, 'Test Title', expected, function (err) {
        if (err) throw err

        done()
      })
    })
  })

})
