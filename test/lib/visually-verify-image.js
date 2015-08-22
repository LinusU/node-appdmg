var hdiutil = require('../../lib/hdiutil')
var looksSame = require('looks-same')
var child_process = require('child_process')
var captureWindow = require('capture-window')

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

    looksSame(pngPath, expectedPath, toleranceOpts, function (err, ok) {
      if (err) return cb(err)
      if (ok) return cb(null)

      cb(new Error('Image looks visually incorrect'))
    })
  })
}

function visuallyVerifyImage (imagePath, title, expectedPath, cb) {
  hdiutil.attach(imagePath, function (err, mountPath) {
    if (err) return cb(err)

    function done (err1) {
      hdiutil.detach(mountPath, function (err2) {
        if (err1) return cb(err1)
        if (err2) return cb(err2)

        cb(null)
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
