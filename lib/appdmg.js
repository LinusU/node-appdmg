
var fs = require('fs');
var path = require('path');
var sizeOf = require('image-size');
var applescript = require('applescript');

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
      if(exists) {
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
      global.specbuffer = buffer;
      next(err);
    });

  });

  /**
   **
   **/

  pipeline.addStep('Parsing JSON Specification', function (next) {

    try {
      global.opts = JSON.parse(global.specbuffer.toString());
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
    check(global.opts, 'icon');
    check(global.opts, 'icons');

    if (global.opts.icons) {
      check(global.opts.icons, 'size', 'icons.size');
      check(global.opts.icons, 'app', 'icons.app');
      check(global.opts.icons, 'alias', 'icons.alias');
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

  pipeline.addStep('Calculating size of image', function (next) {

    util.dusm(resolvePath(global.opts.app), function (err, megabytes) {
      if (err) { return next(err); }

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
    var finalPath = path.join(global.temporaryMountPath, '.VolumeIcon.icns');
    util.cp(resolvePath(global.opts.icon), finalPath, function (err) { next(err); });
  });

  /**
   **
   **/

  pipeline.addStep('Setting icon', function (next) {
    util.seticonflag(global.temporaryMountPath, function (err) { next(err); });
  });

  /**
   **
   **/

  pipeline.addStep('Creating Applications alias', function (next) {

    var finalPath = path.join(global.temporaryMountPath, 'Applications');

    fs.symlink('/Applications', finalPath, function (err) { next(err); });

  });

  /**
   **
   **/

  pipeline.addStep('Copying application', function (next) {

    global.appname = path.basename(global.opts.app);
    var finalPath = path.join(global.temporaryMountPath, global.appname);

    util.sh('cp', ['-R', resolvePath(global.opts.app), finalPath], next);

  });

  /**
   **
   **/

  pipeline.addStep('Making all the visuals', function (next) {
    fs.readFile(__dirname + '/visuals.applescript', function (err, buffer) {
      if (err) { return next(err); }

      var table = {
        'rootpath': global.temporaryMountPath,
        'window.bounds': '{100, 100, ' + (global.bkgsize[0] + 100) + ', ' + (global.bkgsize[1] + 100) + '}',
        'icons.size': global.opts.icons.size,
        'app.name': global.appname,
        'app.position': '{' + global.opts.icons.app.join(', ') + '}',
        'alias.name': 'Applications',
        'alias.position': '{' + global.opts.icons.alias.join(', ') + '}',
        'background.location': global.bkgname.replace(/\//g, ':')
      };

      var script = buffer.toString().replace(/\#\{([a-z\.]+)\}/g, function (m0, m1) {
        return table[m1];
      });

      start = Date.now();

      applescript.execString(script, function(err, res) {
        if (err) {
          next(err);
        } else if ((Date.now() - start) < 10000) {
          next(new Error('Unknown error executing applescript'));
        } else {
          next(null);
        }
      });

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
