
var fs = require('fs');
var path = require('path');

var async = require('async');
var DSStore = require('ds-store');
var sizeOf = require('image-size');

var util = require('./util');
var hdiutil = require('./hdiutil');
var Pipeline = require('./pipeline');

module.exports = exports = function (source, target, cb) {

  if (process.platform !== 'darwin') {
    cb(new Error('Platform not supported: ' + process.platform));
    return ;
  }

  var resolveBase = path.dirname(source);
  var resolvePath = function (to) {
    return path.resolve(resolveBase, to);
  };

  var global = {
    source: source,
    target: target
  };

  delete source;
  delete target;

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

  /**
   **
   **/

  pipeline.addStep('Parsing JSON Specification', function (next) {

    try {

      var obj = JSON.parse(global.specbuffer.toString());
      global.opts = obj;

      var app = [obj.app].concat(obj.icons.app);
      global.files = ([app].concat(obj.extra || []));

      next(null);
    } catch (err) {
      next(err);
    }

  });

  /**
   **
   **/

  pipeline.addStep('Validating JSON Specification', function (next) {

    var missing = [];
    var check = function (root, key, title) {
      if (!root[key]) { missing.push(title || key); }
    }

    check(global.opts, 'title');
    check(global.opts, 'app');
    check(global.opts, 'background');
    check(global.opts, 'icons');

    if (global.opts.icons) {
      check(global.opts.icons, 'size', 'icons.size');
      check(global.opts.icons, 'app', 'icons.app');
    }

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

    async.each(global.files, function (file, cb) {

      var path = resolvePath(file[0]);

      fs.exists(path, function (exists) {
        if (exists) {
          cb(null);
        } else {
          cb(new Error('"' + file[0] + '" not found at: ' + path));
        }
      });

    }, next);

  });

  /**
   **
   **/

  pipeline.addStep('Calculating size of image', function (next) {

    var dusm = util.dusm.bind(util);
    var paths = global.files.map(function (e) { return resolvePath(e[0]); });

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

  pipeline.addStep('Creating Applications alias', function (next) {
    if (global.opts.icons.alias) {
      var finalPath = path.join(global.temporaryMountPath, 'Applications');
      fs.symlink('/Applications', finalPath, function (err) { next(err); });
    } else {
      next.skip();
    }
  });

  /**
   **
   **/

  pipeline.addStep('Copying files', function (next) {

    async.each(global.files, function (file, cb) {

      var basename = path.basename(file[0]);
      var finalPath = path.join(global.temporaryMountPath, basename);

      util.sh('cp', ['-R', resolvePath(file[0]), finalPath], cb);

    }, next);

  });

  /**
   **
   **/

  pipeline.addStep('Making all the visuals', function (next) {

    var ds = new DSStore();

    ds.vSrn(1);
    ds.setIconSize(global.opts.icons.size);
    ds.setBackground(path.join(global.temporaryMountPath, global.bkgname));
    ds.setWindowSize(global.bkgsize[0], global.bkgsize[1]);

    if (global.opts.icons.alias) {
      ds.setIconPos('Applications', global.opts.icons.alias[0], global.opts.icons.alias[1]);
    }

    global.files.forEach(function (e) {
      ds.setIconPos(path.basename(e[0]), e[1], e[2]);
    });

    ds.write(path.join(global.temporaryMountPath, '.DS_Store'), function (err) {
      next(err);
    });

  });

  /**
   **
   **/

  pipeline.addStep('Blessing image', function (next) {

    args = [];
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

  pipeline.run(function (err) {
    cb(err, ( err ? undefined : global.target ));
  });

};
