'use strict'

const fs = require('fs')
const temp = require('fs-temp').template('%s.png')
const looksSame = require('looks-same')
const spawnSync = require('child_process').spawnSync
const captureWindow = require('capture-window')
const sizeOf = require('image-size')

const hdiutil = require('../../lib/hdiutil')

const toleranceOpts = { tolerance: 20 }

function retry (fn, cb) {
  let triesLeft = 8

  function runIteration () {
    fn(function (err) {
      if (!err) return cb(null)
      if (--triesLeft === 0) return cb(err)

      setTimeout(runIteration, 150)
    })
  }

  setTimeout(runIteration, 700)
}

function captureAndVerify (title, expectedPath, cb) {
  captureWindow('Finder', title, function (err, pngPath) {
    if (err) return cb(err)

    const actualSize = sizeOf(pngPath)
    const expectedSize = sizeOf(expectedPath)

    // If the actual size is scaled by two, use the retina image.
    if (actualSize.width === expectedSize.width * 2 && actualSize.height === expectedSize.height * 2) {
      expectedPath = expectedPath.replace(/(\.[^.]*)$/, '@2x$1')
    }

    looksSame(pngPath, expectedPath, toleranceOpts, function (err1, ok) {
      fs.unlink(pngPath, function (err2) {
        if (err1) return cb(err1)
        if (err2) return cb(err2)
        if (ok) return cb(null)

        cb(Object.assign(new Error('Image looks visually incorrect'), { code: 'VISUALLY_INCORRECT' }))
      })
    })
  })
}

function captureAndSaveDiff (title, expectedPath, cb) {
  captureWindow('Finder', title, function (err, pngPath) {
    if (err) return cb(err)

    const opts = Object.assign({
      reference: expectedPath,
      current: pngPath,
      highlightColor: '#f0f'
    }, toleranceOpts)

    looksSame.createDiff(opts, function (err, data) {
      if (err) return cb(err)

      temp.writeFile(data, function (err, diffPath) {
        if (err) return cb(err)

        cb(null, { diff: diffPath, actual: pngPath })
      })
    })
  })
}

function visuallyVerifyImage (imagePath, title, expectedPath, cb) {
  hdiutil.attach(imagePath, function (err, mountPath) {
    if (err) return cb(err)

    function done (err1) {
      function detach (err3) {
        hdiutil.detach(mountPath, function (err2) {
          if (err1) return cb(err1)
          if (err2) return cb(err2)
          if (err3) return cb(err3)

          cb(null)
        })
      }

      if (!err1 || err1.code !== 'VISUALLY_INCORRECT') {
        return detach()
      }

      captureAndSaveDiff(title, expectedPath, function (err3, res) {
        if (err3) return detach(err3)

        console.error('A diff of the images have been saved to:', res.diff)
        console.error('The actual image have been saved to:', res.actual)
        detach()
      })
    }

    try {
      spawnSync('open', ['-a', 'Finder', mountPath])
    } catch (spawnErr) {
      return done(spawnErr)
    }

    retry(function (cb) {
      captureAndVerify(title, expectedPath, cb)
    }, done)
  })
}

module.exports = visuallyVerifyImage
