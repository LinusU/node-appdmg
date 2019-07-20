/* eslint-env mocha */

'use strict'

const execa = require('execa')
const fs = require('fs')
const path = require('path')
const temp = require('fs-temp')
const assert = require('assert')

const appdmg = require('../')
const imageFormat = require('./lib/image-format')
const visuallyVerifyImage = require('./lib/visually-verify-image')

const STEPS = 22

function runAppdmg (opts, verify, cb, extra) {
  let progressCalled = 0
  const ee = appdmg(opts)

  ee.on('progress', function () {
    progressCalled++
  })

  ee.on('error', cb)

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

  if (extra) {
    extra(ee)
  }
}

describe('api', function () {
  let targetDir, targetPath

  beforeEach(function () {
    targetDir = temp.mkdirSync()
    targetPath = path.join(targetDir, 'Test.dmg')
  })

  afterEach(function () {
    try {
      fs.unlinkSync(targetPath)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err
      }
    }

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

  it('pauses pipeline execution when told to', function (done) {
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
          { x: 512, y: 128, type: 'file', path: 'TestDoc.txt', name: 'Documentation.txt' },
          { x: 0, y: 0, type: 'file', path: path.join('TestApp.app', 'Contents', 'Resources'), name: 'Super Secret Folder' }
        ]
      }
    }

    const verify = {
      format: 'UDZO',
      title: 'Test Title',
      visually: 'accepted-3.png'
    }

    runAppdmg(opts, verify, done, ee => {
      async function hideSecretFolder () {
        // Sleep for 0.5 seconds, to verify that the disk image isn't unmounted before this promise resolves.
        await new Promise(resolve => setTimeout(resolve, 500))

        await execa('SetFile', [
          '-a',
          'V',
          path.join(ee.temporaryMountPath, 'Super Secret Folder')
        ])
      }

      ee.on('progress', info => {
        if (info.type === 'step-begin' && info.title === 'Unmounting temporary image') {
          ee.waitFor(hideSecretFolder())
        }
      })
    })
  })

  it('aborts pipeline execution when told to', function (done) {
    this.timeout(5000) // 5 seconds

    const opts = {
      target: targetPath,
      source: path.join(__dirname, 'assets', 'appdmg.json')
    }

    const ee = appdmg(opts)
    const err = new Error('test error')

    ee.on('progress', () => {
      ee.abort(err)
    })

    ee.on('finish', () => {
      done(new Error('Pipeline execution did not abort'))
    })

    ee.on('error', _err => {
      if (err === _err) {
        if (fs.existsSync(targetPath)) {
          done(new Error('Pipeline execution was aborted, but it created a disk image file anyway'))
        } else {
          done()
        }
      } else {
        done(new Error(`Pipeline execution was aborted with wrong error: ${_err}`))
      }
    })
  })

  for (const getPromiseAfterEnd of [false, true]) {
    it(`resolves asPromise when done${getPromiseAfterEnd ? ', even after the fact' : ''}`, function (done) {
      this.timeout(30000) // 30 seconds

      const opts = {
        target: targetPath,
        source: path.join(__dirname, 'assets', 'appdmg.json')
      }

      const ee = appdmg(opts)

      if (getPromiseAfterEnd) {
        ee.on('error', done)
        ee.on('finish', () => {
          ee.asPromise.then(done, done)
        })
      } else {
        ee.asPromise.then(done, done)
      }
    })

    it(`rejects asPromise when aborted${getPromiseAfterEnd ? ', even after the fact' : ''}`, function (done) {
      this.timeout(5000) // 5 seconds

      const opts = {
        target: targetPath,
        source: path.join(__dirname, 'assets', 'appdmg.json')
      }

      const ee = appdmg(opts)

      const err = new Error('test error')

      ee.on('progress', info => {
        if (info.type === 'step-begin' && info.title === 'Creating temporary image') {
          ee.abort(err)
        }
      })

      function getAndCheckPromise () {
        ee.asPromise.then(
          () => done(new Error('appdmg().asPromise should have rejected, but didn\'t')),
          _err => {
            if (err === _err) {
              done()
            } else {
              done(new Error(`appdmg().asPromise rejected with wrong error: ${_err}`))
            }
          }
        )
      }

      if (getPromiseAfterEnd) {
        ee.on('error', getAndCheckPromise)
        ee.on('finish', getAndCheckPromise)
      } else {
        getAndCheckPromise()
      }
    })
  }
})
