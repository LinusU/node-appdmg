'use strict'

const fs = require('fs')
const path = require('path')

const async = require('async')
const DSStore = require('ds-store')
const sizeOf = require('image-size')
const validator = require('is-my-json-valid')
const parseColor = require('parse-color')

const util = require('./util')
const hdiutil = require('./hdiutil')
const Pipeline = require('./pipeline')
const schema = require('../schema')

const validateSpec = validator(schema, {
  formats: {
    'css-color': (text) => Boolean(parseColor(text).rgb)
  }
})

function hasKeys (obj, props) {
  function hasKey (key) { return obj.hasOwnProperty(key) }

  return (props.filter(hasKey).length === props.length)
}

function parseOptions (options) {
  if (typeof options !== 'object') {
    throw new Error('`options` must be an object')
  }

  if (hasKeys(options, ['target']) === false) {
    throw new Error('Missing option `target`')
  }

  const parsed = {}
  const hasSource = hasKeys(options, ['source'])
  const hasSpec = hasKeys(options, ['basepath', 'specification'])

  if (hasSource === hasSpec) {
    throw new Error('Supply one of `source` or `(basepath, specification)`')
  }

  if (hasSource) {
    parsed.hasSpec = false
    parsed.source = options.source
    parsed.target = options.target
    parsed.resolveBase = path.dirname(options.source)
  }

  if (hasSpec) {
    parsed.hasSpec = true
    parsed.target = options.target
    parsed.opts = options.specification
    parsed.resolveBase = options.basepath
  }

  return parsed
}

module.exports = exports = function (options) {
  if (process.platform !== 'darwin') {
    throw new Error(`Platform not supported: ${process.platform}`)
  }

  const global = parseOptions(options)
  const resolvePath = (to) => path.resolve(global.resolveBase, to)

  const pipeline = new Pipeline()

  /**
   **
   **/

  pipeline.addStep('Looking for target', function (next) {
    fs.writeFile(global.target, '', { flag: 'wx' }, function (err) {
      if (err && err.code === 'EEXIST') return next(new Error('Target already exists'))
      if (err) return next(err)

      pipeline.addCleanupStep('unlink-target', 'Removing target image', function (next, hasErrored) {
        if (hasErrored) {
          fs.unlink(global.target, next)
        } else {
          next(null)
        }
      })
      next(null)
    })
  })

  /**
   **
   **/

  pipeline.addStep('Reading JSON Specification', function (next) {
    if (global.hasSpec) return next.skip()

    fs.readFile(global.source, function (err, buffer) {
      if (err && err.code === 'ENOENT' && err.path) {
        next(new Error(`JSON Specification not found at: ${err.path}`))
      } else {
        global.specbuffer = buffer
        next(err)
      }
    })
  })

  /**
   **
   **/

  pipeline.addStep('Parsing JSON Specification', function (next) {
    if (global.hasSpec) return next.skip()

    try {
      const obj = JSON.parse(global.specbuffer.toString())

      if (obj.icons) {
        const legacy = require('./legacy')
        global.opts = legacy.convert(obj)
      } else {
        global.opts = obj
      }

      next(null)
    } catch (err) {
      next(err)
    }
  })

  /**
   **
   **/

  pipeline.addStep('Validating JSON Specification', function (next) {
    if (validateSpec(global.opts)) return next(null)

    function formatError (error) {
      return `${error.field} ${error.message}`
    }

    const message = validateSpec.errors.map(formatError).join(', ')

    next(new Error(message))
  })

  /**
   **
   **/

  pipeline.addStep('Looking for files', function (next) {
    function find (type) {
      return global.opts.contents.filter(function (e) {
        return (e.type === type)
      })
    }

    global.links = find('link')
    global.files = find('file')

    async.each(global.files, function (file, cb) {
      const path = resolvePath(file.path)

      util.pathExists(path, function (err, exists) {
        if (err) {
          cb(err)
        } else if (exists) {
          cb(null)
        } else {
          cb(new Error(`"${file.path}" not found at: ${path}`))
        }
      })
    }, next)
  })

  /**
   **
   **/

  pipeline.addStep('Calculating size of image', function (next) {
    const dusm = util.dusm.bind(util)
    const paths = global.files.map((e) => resolvePath(e.path))

    async.map(paths, dusm, function (err, sizes) {
      if (err) return next(err)

      let megabytes = sizes.reduce((p, c) => p + c, 0)

      // FIXME: I think that this has something to do
      // with blocksize and minimum file size...
      // This should work for now but requires more
      // space than it should. Note that this does
      // not effect the final image.
      megabytes = megabytes * 1.5

      global.megabytes = (megabytes + 32)
      next(null)
    })
  })

  /**
   **
   **/

  pipeline.addStep('Creating temporary image', function (next) {
    hdiutil.create(global.opts.title, `${global.megabytes}m`, function (err, temporaryImagePath) {
      if (err) return next(err)

      pipeline.addCleanupStep('unlink-temporary-image', 'Removing temporary image', function (next) {
        fs.unlink(temporaryImagePath, next)
      })

      global.temporaryImagePath = temporaryImagePath
      next(null)
    })
  })

  /**
   **
   **/

  pipeline.addStep('Mounting temporary image', function (next) {
    hdiutil.attach(global.temporaryImagePath, function (err, temporaryMountPath) {
      if (err) return next(err)

      pipeline.addCleanupStep('unmount-temporary-image', 'Unmounting temporary image', function (next) {
        hdiutil.detach(temporaryMountPath, next)
      })

      global.temporaryMountPath = temporaryMountPath
      next(null)
    })
  })

  /**
   **
   **/

  pipeline.addStep('Making hidden background folder', function (next) {
    global.bkgdir = path.join(global.temporaryMountPath, '.background')
    fs.mkdir(global.bkgdir, next)
  })

  /**
   **
   **/

  pipeline.addStep('Copying background', function (next) {
    if (!global.opts.background) return next.skip()

    const absolutePath = resolvePath(global.opts.background)
    const retinaPath = absolutePath.replace(/\.([a-z]+)$/, '@2x.$1')

    function copyRetinaBackground (next) {
      const originalExt = path.extname(global.opts.background)
      const outputName = `${path.basename(global.opts.background, originalExt)}.tiff`
      const finalPath = path.join(global.bkgdir, outputName)
      global.bkgname = path.join('.background', outputName)
      util.tiffutil(absolutePath, retinaPath, finalPath, next)
    }

    function copyPlainBackground (next) {
      const finalPath = path.join(global.bkgdir, path.basename(global.opts.background))
      global.bkgname = path.join('.background', path.basename(global.opts.background))
      fs.copyFile(absolutePath, finalPath, next)
    }

    util.pathExists(retinaPath, function (err, exists) {
      if (err) {
        return next(err)
      } else if (exists) {
        copyRetinaBackground(next)
      } else {
        copyPlainBackground(next)
      }
    })
  })

  /**
   **
   **/

  pipeline.addStep('Reading background dimensions', function (next) {
    if (!global.opts.background) return next.skip()

    sizeOf(resolvePath(global.opts.background), function (err, value) {
      if (err) return next(err)

      global.bkgsize = [value.width, value.height]
      next(null)
    })
  })

  /**
   **
   **/

  pipeline.addStep('Copying icon', function (next) {
    if (global.opts.icon) {
      const finalPath = path.join(global.temporaryMountPath, '.VolumeIcon.icns')
      fs.copyFile(resolvePath(global.opts.icon), finalPath, next)
    } else {
      next.skip()
    }
  })

  /**
   **
   **/

  pipeline.addStep('Setting icon', function (next) {
    if (global.opts.icon) {
      util.seticonflag(global.temporaryMountPath, next)
    } else {
      next.skip()
    }
  })

  /**
   **
   **/

  pipeline.addStep('Creating links', function (next) {
    if (global.links.length === 0) {
      return next.skip()
    }

    async.each(global.links, function (entry, cb) {
      const name = entry.name || path.basename(entry.path)
      const finalPath = path.join(global.temporaryMountPath, name)

      fs.symlink(entry.path, finalPath, cb)
    }, next)
  })

  /**
   **
   **/

  pipeline.addStep('Copying files', function (next) {
    if (global.files.length === 0) {
      return next.skip()
    }

    async.each(global.files, function (entry, cb) {
      const name = entry.name || path.basename(entry.path)
      const finalPath = path.join(global.temporaryMountPath, name)

      util.sh('cp', ['-R', resolvePath(entry.path), finalPath], cb)
    }, next)
  })

  /**
   **
   **/

  pipeline.addStep('Making all the visuals', function (next) {
    const ds = new DSStore()

    ds.vSrn(1)
    ds.setIconSize(global.opts['icon-size'] || 80)

    if (global.opts['background-color']) {
      const rgb = parseColor(global.opts['background-color']).rgb
      ds.setBackgroundColor(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
    }

    if (global.opts.background) {
      ds.setBackgroundPath(path.join(global.temporaryMountPath, global.bkgname))
    }

    if (global.opts.window && global.opts.window.size) {
      ds.setWindowSize(global.opts.window.size.width, global.opts.window.size.height)
    } else if (global.bkgsize) {
      ds.setWindowSize(global.bkgsize[0], global.bkgsize[1])
    } else {
      ds.setWindowSize(640, 480)
    }

    if (global.opts.window && global.opts.window.position) {
      ds.setWindowPos(global.opts.window.position.x, global.opts.window.position.y)
    }

    for (const e of global.opts.contents) {
      ds.setIconPos(e.name || path.basename(e.path), e.x, e.y)
    }

    ds.write(path.join(global.temporaryMountPath, '.DS_Store'), (err) => next(err))
  })

  /**
   **
   **/

  pipeline.addStep('Blessing image', function (next) {
    const args = [
      '--folder', global.temporaryMountPath
    ]

    if (os.arch() !== 'arm64') {
      args.push('--openfolder', global.temporaryMountPath)
    }

    util.sh('bless', args, next)
  })

  /**
   **
   **/

  pipeline.addStep('Unmounting temporary image', function (next) {
    pipeline.runCleanup('unmount-temporary-image', next)
  })

  /**
   **
   **/

  pipeline.addStep('Finalizing image', function (next) {
    const format = (global.opts.format || 'UDZO')

    hdiutil.convert(global.temporaryImagePath, format, global.target, next)
  })

  /**
   **
   **/

  pipeline.addStep('Signing image', function (next) {
    const codeSignOptions = global.opts['code-sign']
    if (codeSignOptions && codeSignOptions['signing-identity']) {
      const codeSignIdentity = codeSignOptions['signing-identity']
      const codeSignIdentifier = codeSignOptions['identifier']
      util.codesign(codeSignIdentity, codeSignIdentifier, global.target, next)
    } else {
      return next.skip()
    }
  })

  /**
   **
   **/

  pipeline.expectAdditional(1)

  return pipeline.run()
}
