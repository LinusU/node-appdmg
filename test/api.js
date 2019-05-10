/* eslint-env mocha */

'use strict'

const execa = require('execa')
const fs = require('fs')
const path = require('path')
const plist = require('plist')
const readXml = require('read-xml')
const { pipeline, Writable } = require('stream')
const temp = require('fs-temp')
const assert = require('assert')

const appdmg = require('../')
const imageFormat = require('./lib/image-format')
const visuallyVerifyImage = require('./lib/visually-verify-image')

const STEPS = 23

function runAppdmg (opts, verify, cb) {
  let progressCalled = 0
  const ee = appdmg(opts)

  ee.on('progress', function () {
    progressCalled++
  })

  ee.on('finish', function () {
    try {
      assert.strictEqual(progressCalled, STEPS * 2)
      assert.strictEqual(imageFormat(opts.target), verify.format)
    } catch (err) {
      return cb(err)
    }

    const expected = path.join(__dirname, verify.visually)
    visuallyVerifyImage(opts.target, verify.title, expected, cb)
  })
}

describe('api', function () {
  let targetDir, targetPath

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

    const opts = {
      target: targetPath,
      source: path.join(__dirname, 'assets', 'appdmg.json')
    }

    const verify = {
      format: 'UDZO',
      title: 'Test Title',
      visually: 'accepted-1.png'
    }

    runAppdmg(opts, verify, done)
  })

  it('creates an image from a legacy specification', function (done) {
    this.timeout(60000) // 1 minute

    const opts = {
      target: targetPath,
      source: path.join(__dirname, 'assets', 'appdmg-legacy.json')
    }

    const verify = {
      format: 'UDZO',
      title: 'Test Title',
      visually: 'accepted-1.png'
    }

    runAppdmg(opts, verify, done)
  })

  it('creates an image from a passed options', function (done) {
    this.timeout(60000) // 1 minute

    const opts = {
      target: targetPath,
      basepath: path.join(__dirname, 'assets'),
      specification: {
        title: 'Test Title',
        icon: 'TestIcon.icns',
        background: 'TestBkg.png',
        contents: [
          { x: 448, y: 344, type: 'link', path: '/Applications' },
          { x: 192, y: 344, type: 'file', path: 'TestApp.app' },
          { x: 512, y: 128, type: 'file', path: 'TestDoc.txt' }
        ]
      }
    }

    const verify = {
      format: 'UDZO',
      title: 'Test Title',
      visually: 'accepted-1.png'
    }

    runAppdmg(opts, verify, done)
  })

  it('creates an image without compression', function (done) {
    this.timeout(60000) // 1 minute

    const opts = {
      target: targetPath,
      basepath: path.join(__dirname, 'assets'),
      specification: {
        title: 'Test Title',
        icon: 'TestIcon.icns',
        background: 'TestBkg.png',
        format: 'UDRO',
        contents: [
          { x: 448, y: 344, type: 'link', path: '/Applications' },
          { x: 192, y: 344, type: 'file', path: 'TestApp.app' },
          { x: 512, y: 128, type: 'file', path: 'TestDoc.txt' }
        ]
      }
    }

    const verify = {
      format: 'UDRO',
      title: 'Test Title',
      visually: 'accepted-1.png'
    }

    runAppdmg(opts, verify, done)
  })

  it('creates an image with a background color', function (done) {
    this.timeout(60000) // 1 minute

    const opts = {
      target: targetPath,
      source: path.join(__dirname, 'assets', 'appdmg-bg-color.json')
    }

    const verify = {
      format: 'UDZO',
      title: 'Test Title',
      visually: 'accepted-2.png'
    }

    runAppdmg(opts, verify, done)
  })

  it('creates an image with custom names', function (done) {
    this.timeout(60000) // 1 minute

    const opts = {
      target: targetPath,
      basepath: path.join(__dirname, 'assets'),
      specification: {
        title: 'Test Title',
        icon: 'TestIcon.icns',
        background: 'TestBkg.png',
        contents: [
          { x: 448, y: 344, type: 'link', path: '/Applications', name: 'System Apps' },
          { x: 192, y: 344, type: 'file', path: 'TestApp.app', name: 'My Nice App.app' },
          { x: 512, y: 128, type: 'file', path: 'TestDoc.txt', name: 'Documentation.txt' }
        ]
      }
    }

    const verify = {
      format: 'UDZO',
      title: 'Test Title',
      visually: 'accepted-3.png'
    }

    runAppdmg(opts, verify, done)
  })

  it('creates an image with a license agreement', function (done) {
    this.timeout(60000) // 1 minute

    const ee = appdmg({
      target: targetPath,
      basepath: path.join(__dirname, 'assets'),
      specification: {
        title: 'Test Title',
        contents: [],
        license: {
          body: [{
            lang: 'en-US',
            text: 'Hello, world!'
          }]
        }
      }
    })

    ee.on('finish', function () {
      const child = execa(
        'hdiutil',
        ['udifderez', '-xml', targetPath],
        {
          stdio: ['inherit', 'pipe', 'inherit'],
          timeout: 60000
        }
      )

      let xmlStr = ''

      const childPipe = pipeline(
        child.stdout,
        readXml.createStream(),
        new Writable({
          decodeStrings: false,
          write (chunk, encoding, cb) {
            xmlStr += chunk
            cb()
          }
        }),
        function (err) {
          if (err) {
            return done(err)
          }

          try {
            const pl = plist.parse(xmlStr)
            const textRez = pl.TEXT[0]

            assert.strictEqual(textRez.ID, '5000')
            assert.strictEqual(pl.TEXT[0].Data.toString('ascii'), 'Hello, world!')
          } catch (err) {
            return done(err)
          }

          done()
        }
      )

      child.on('error', function (err) {
        childPipe.destroy()
        done(err)
      })

      child.on('exit', function (code) {
        if (code) {
          childPipe.destroy()
          done(new Error(`hdiutil udifderez exited with code ${code}.`))
        }
      })
    })
  })
})
