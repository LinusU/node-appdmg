var fs = require('fs')
var temp = require('fs-temp').template('%s.png')
var looksSame = require('looks-same')
var child_process = require('child_process')
var captureWindow = require('capture-window')
var sizeOf = require('image-size')

var hdiutil = require('../../lib/hdiutil')

var toleranceOpts = { tolerance: 20 }

function retry (fn, cb) {
  var triesLeft = 8

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
      expectedPath = expectedPath.replace('.png', '@2x.png')
    }

    looksSame(pngPath, expectedPath, toleranceOpts, function (err1, ok) {
      fs.unlink(pngPath, function (err2) {
        if (err1) return cb(err1)
        if (err2) return cb(err2)
        if (ok) return cb(null)

        var err = new Error('Image looks visually incorrect')
        err.code = 'VISUALLY_INCORRECT'
        cb(err)
      })
    })
  })
}

function captureAndSaveDiff (title, expectedPath, cb) {
  captureWindow('Finder', title, function (err, pngPath) {
    if (err) return cb(err)

    var opts = Object.assign({
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
      child_process.spawnSync('open', ['-a', 'Finder', mountPath])
    } catch (spawnErr) {
      return done(spawnErr)
    }

    retry(function (cb) {
      captureAndVerify(title, expectedPath, cb)
    }, done)
  })
}

module.exports = visuallyVerifyImage
