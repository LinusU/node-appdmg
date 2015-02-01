
var fs = require('fs');
var path = require('path');

var async = require('async');
var DSStore = require('ds-store');
var sizeOf = require('image-size');

var util = require('./util');
var hdiutil = require('./hdiutil');
var Pipeline = require('./pipeline');

module.exports = exports = function (config, cb) {

  if (process.platform !== 'darwin') {
    throw new Error('Platform not supported: ' + process.platform);
  }

  var basepath = config.basepath;
  var specification = config.specification;
  var source = config.source;
  var target = config.target;

  if (!basepath) {
    if (source) {
      basepath = path.dirname(source);
    } else {
      basepath = process.cwd();
    }
  }

  var resolvePath = function (to) {
    return path.resolve(basepath, to);
  };

  var global = {
    target: target
  };

  if (source) {
    global.source = source;
  } else {
    global.opts = specification;
  }

  var pipeline = new Pipeline();

  /**
   **
   **/

  pipeline.addStep('Looking for target', function (next) {

    fs.exists(global.target, function (exists) {
      if (exists) {
        next(new Error('Target already exists'));
      } else {
        next(null);
      }
    });

  });

  /**
   **
   **/

  if (!global.opts) {

    pipeline.addStep('Reading JSON Specification', function (next) {

      fs.readFile(global.source, function(err, buffer) {
        if (err && err.code === 'ENOENT' && err.path) {
          next(new Error('JSON Specification not found at: ' + err.path));
        } else {
          global.specbuffer = buffer;
          next(err);
        }
      });

    });

  }

  /**
   **
   **/

  if (!global.opts) {

    pipeline.addStep('Parsing JSON Specification', function (next) {

      try {

        var obj = JSON.parse(global.specbuffer.toString());

        if (obj.icons) {
          var legacy = require('./legacy');
          global.opts = legacy.convert(obj);
        } else {
          global.opts = obj;
        }

        next(null);
      } catch (err) {
        next(err);
      }

    });

  }

  /**
   **
   **/

  pipeline.addStep('Validating JSON Specification', function (next) {

    var missing = [];
    var check = function (root, key, title) {
      if (!root[key]) { missing.push(title || key); }
    };

    check(global.opts, 'title');
    check(global.opts, 'background');
    check(global.opts, 'icon-size');

    (global.opts.contents || []).forEach(function (entry, i) {
      check(entry, 'x', 'contents.' + i + '.x');
      check(entry, 'y', 'contents.' + i + '.y');
      check(entry, 'type', 'contents.' + i + '.type');
      check(entry, 'path', 'contents.' + i + '.path');
    });

    if (missing.length > 0) {
      next(new Error('`' + (missing.join('`,`')) + '` missing from JSON Specification'));
    } else {
      next(null);
    }

  });

  /**
   **
   **/

  pipeline.addStep('Looking for files', function (next) {

    function find(type) {
      return (global.opts.contents || []).filter(function (e) {
        return (e.type === type);
      });
    }

    global.links = find('link');
    global.files = find('file');

    async.each(global.files, function (file, cb) {

      var path = resolvePath(file.path);

      fs.exists(path, function (exists) {
        if (exists) {
          cb(null);
        } else {
          cb(new Error('"' + file.path + '" not found at: ' + path));
        }
      });

    }, next);

  });

  /**
   **
   **/

  pipeline.addStep('Calculating size of image', function (next) {

    var dusm = util.dusm.bind(util);
    var paths = global.files.map(function (e) { return resolvePath(e.path); });

    async.map(paths, dusm, function (err, sizes) {
      if (err) { return next(err); }

      var megabytes = sizes.reduce(function (p, c) {
        return p + c;
      }, 0);

      // FIXME: I think that this has something to do
      // with blocksize and minimum file size...
      // This should work for now but requires more
      // space than it should. Note that this does
      // not effect the final image.
      megabytes = megabytes * 1.5;

      global.megabytes = (megabytes + 32);
      next(null);
    });

  });

  /**
   **
   **/

  pipeline.addStep('Creating temporary image', function (next) {

    hdiutil.create(global.opts.title, global.megabytes + 'm', function (err, temporaryImagePath) {
      if (err) { return next(err); }

      pipeline.addCleanupStep('unlink-temporay-image', 'Removing temporary image', function (next) {
        fs.unlink(temporaryImagePath, next);
      });

      global.temporaryImagePath = temporaryImagePath;
      next(null);
    });

  });

  /**
   **
   **/

  pipeline.addStep('Mounting temporary image', function (next) {

    hdiutil.attach(global.temporaryImagePath, function (err, temporaryMountPath) {
      if (err) { return next(err); }

      pipeline.addCleanupStep('unmount-temporary-image', 'Unmounting temporary image', function (next) {
        hdiutil.detach(temporaryMountPath, next);
      });

      global.temporaryMountPath = temporaryMountPath;
      next(null);
    });

  });

  /**
   **
   **/

  pipeline.addStep('Making hidden background folder', function (next) {
    global.bkgdir = path.join(global.temporaryMountPath, '.background');
    fs.mkdir(global.bkgdir, function (err) { next(err); });
  });

  /**
   **
   **/

  pipeline.addStep('Copying background', function (next) {

    var absolutePath = resolvePath(global.opts.background);
    var retinaPath = absolutePath.replace(/\.([a-z]+)$/, '@2x.$1');

    var copyRetinaBackground = function (next) {
      var originalExt = path.extname(global.opts.background);
      var outputName = path.basename(global.opts.background, originalExt) + '.tiff';
      var finalPath = path.join(global.bkgdir, outputName);
      global.bkgname = path.join('.background', outputName);
      util.tiffutil(absolutePath, retinaPath, finalPath, function (err) { next(err); });
    };

    var copyPlainBackground = function (next) {
      var finalPath = path.join(global.bkgdir, path.basename(global.opts.background));
      global.bkgname = path.join('.background', path.basename(global.opts.background));
      util.cp(absolutePath, finalPath, function (err) { next(err); });
    };

    fs.exists(retinaPath, function (exists) {
      if (exists) {
        copyRetinaBackground(next);
      } else {
        copyPlainBackground(next);
      }
    });

  });

  /**
   **
   **/

  pipeline.addStep('Reading background dimensions', function (next) {
    sizeOf(resolvePath(global.opts.background), function (err, value) {
      if (err) { return next(err); }

      global.bkgsize = [value.width, value.height];
      next(null);

    });
  });

  /**
   **
   **/

  pipeline.addStep('Copying icon', function (next) {
    if (global.opts.icon) {
      var finalPath = path.join(global.temporaryMountPath, '.VolumeIcon.icns');
      util.cp(resolvePath(global.opts.icon), finalPath, function (err) { next(err); });
    } else {
      next.skip();
    }
  });

  /**
   **
   **/

  pipeline.addStep('Setting icon', function (next) {
    if (global.opts.icon) {
      util.seticonflag(global.temporaryMountPath, function (err) { next(err); });
    } else {
      next.skip();
    }
  });

  /**
   **
   **/

  pipeline.addStep('Creating links', function (next) {

    if (global.links.length === 0) {
      return next.skip();
    }

    async.each(global.links, function (entry, cb) {

      var title = path.basename(entry.path);
      var finalPath = path.join(global.temporaryMountPath, title);

      fs.symlink(entry.path, finalPath, function (err) { cb(err); });

    }, next);

  });

  /**
   **
   **/

  pipeline.addStep('Copying files', function (next) {

    if (global.files.length === 0) {
      return next.skip();
    }

    async.each(global.files, function (entry, cb) {

      var title = path.basename(entry.path);
      var finalPath = path.join(global.temporaryMountPath, title);

      util.sh('cp', ['-R', resolvePath(entry.path), finalPath], cb);

    }, next);

  });

  /**
   **
   **/

  pipeline.addStep('Making all the visuals', function (next) {

    var ds = new DSStore();

    ds.vSrn(1);
    ds.setIconSize(global.opts['icon-size']);
    ds.setBackground(path.join(global.temporaryMountPath, global.bkgname));
    ds.setWindowSize(global.bkgsize[0], global.bkgsize[1]);

    global.opts.contents.forEach(function (e) {
      ds.setIconPos(path.basename(e.path), e.x, e.y);
    });

    ds.write(path.join(global.temporaryMountPath, '.DS_Store'), function (err) {
      next(err);
    });

  });

  /**
   **
   **/

  pipeline.addStep('Blessing image', function (next) {

    var args = [];
    args.push('--folder', global.temporaryMountPath);
    args.push('--openfolder', global.temporaryMountPath);

    util.sh('bless', args, next);

  });

  /**
   **
   **/

  pipeline.addStep('Unmounting temporary image', function (next) {
    pipeline.runCleanup('unmount-temporary-image', next);
  });

  /**
   **
   **/

  pipeline.addStep('Finalizing image', function (next) {
    hdiutil.convert(global.temporaryImagePath, global.target, next);
  });

  /**
   **
   **/

  pipeline.expectAdditional(1);

  var ee = pipeline.run();

  if (cb) {
    ee.on('error', cb);
    ee.on('finish', cb.bind(this, null, global.target));
  }

  return ee;
};
