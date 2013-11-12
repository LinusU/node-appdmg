
var fs = require('fs');
var path = require('path');

var temp = require('temp');
var optimist = require('optimist');
var applescript = require('applescript');

var util = require('./lib/util');

var statusBeginStep = (function () {
  var n = 0;
  return function (title) {
    var line = '[' + (n < 9 ? ' ' : '') + (++n) + '/12] ' + title + '...';
    process.stderr.write('\r' + line + String.repeat(' ', 40 - line.length))
  };
})();
var statusStepError = function () {
  process.stderr.write('[FAIL]\n');
};
var statusStepOK = function () {
  process.stderr.write('[ OK ]\n');
};

var convertImage = function (source, target, cb) {
  var args = [];
  args.push('convert', source);
  args.push('-format', 'UDZO');
  args.push('-imagekey', 'zlib-level=9');
  args.push('-o', target);
  util.sh('hdiutil', args, function (err) {
    cb(err, ( err ? undefined : target ));
  });
};

var createImage = function (volname, size, cb) {
  var args = [];
  var outname = temp.path({ suffix: '.dmg' });
  args.push('create', outname);
  args.push('-fs', 'HFS+');
  args.push('-size', size);
  args.push('-volname', volname);
  util.sh('hdiutil', args, function (err) {
    cb(err, ( err ? undefined : outname ));
  });
};

var mountImage = function (path, cb) {
  var args = [];
  args.push('attach', path);
  args.push('-nobrowse');
  args.push('-noverify');
  args.push('-noautoopen');
  util.sh('hdiutil', args, function (err, res) {
    if (err) { return cb(err); }

    m = /Apple_HFS\s+(.*)\s*$/.exec(res.stdout)
    if (m === null) {
      cb(new Error('Failed to mount image'));
    } else {
      cb(null, m[1]);
    }

  });
};

var unmountImage = function (path, cb) {
  var args = [];
  args.push('detach', path);
  util.sh('hdiutil', args, function (err) {
    cb(err);
  });
};

var copyBackground = function (dirname, picture, cb) {

  var hiddenDir = path.join(dirname, '.background');
  var finalPath = path.join(hiddenDir, path.basename(picture));
  var relativePath = path.join('.background', path.basename(picture));

  fs.mkdir(hiddenDir, function (err) {
    if (err) { return cb(err); }

    util.cp(picture, finalPath, function (err) {
      cb(err, ( err ? undefined : relativePath ));
    });

  });

};

var copyApp = function (dirname, source, cb) {

  var relativePath = path.basename(source);
  var finalPath = path.join(dirname, relativePath);

  util.sh('cp', ['-r', source, finalPath], function (err, res) {
    cb(err, ( err ? undefined : relativePath ));
  });

};

var createAlias = function (dirname, cb) {

  var relativePath = 'Applications';
  var finalPath = path.join(dirname, relativePath);

  fs.symlink('/Applications', finalPath, function (err) {
    cb(err, ( err ? undefined : relativePath ));
  });

};

var makeVisuals = function (dirname, bkgname, appname, volname, icons, cb) {
  fs.readFile(__dirname + '/lib/visuals.applescript', function (err, buffer) {
    if (err) { return cb(err); }

    /*
      window.bounds: {x, y, x2, y2}
        x2: x + background width
        y2: y + background height
    */

    var table = {
      'rootpath': dirname,
      'window.bounds': '{100, 100, 640, 480}',
      'icons.size': icons.size,
      'app.name': appname,
      'app.position': '{' + icons.app.join(', ') + '}',
      'alias.name': 'Applications',
      'alias.position': '{' + icons.alias.join(', ') + '}',
      // 'background.location': bkgname.replace(/\//g, ':')
      // 'background.location': '/Volumes/' + volname + '/' + bkgname
      'background.location': '/Users/linus/Desktop/Portal.png'
    };

    var script = buffer.toString().replace(/\#\{([a-z\.]+)\}/g, function (m0, m1) {
      return table[m1];
    });

    start = Date.now();

    applescript.execString(script, function(err, res) {
      if (err) {
        cb(err);
      } else if ((Date.now() - start) < 10000) {
        cb(new Error('Unknown error executing applescript'));
      } else {
        cb(null);
      }
    });

  });
};

var readOpts = function (path, cb) {
  fs.readFile(path, function(err, buffer) {
    if (err) {
      cb(err);
    } else try {
      cb(null, JSON.parse(buffer.toString()));
    } catch (err) {
      cb(err);
    }
  });
};

var appdmg = function (source, target, cb) {

  statusBeginStep('Looking for target');
  fs.exists(target, function (exists) {
    if (exists) { statusStepError(); return cb(new Error('Target already exists')); }
    statusStepOK();

    statusBeginStep('Reading JSON Specification');
    readOpts(source, function (err, opts) {
      if (err) { statusStepError(); return cb(err); }
      statusStepOK();

      statusBeginStep('Calculating size of image');
      util.dusm(opts.app, function (err, megabytes) {
        if (err) { statusStepError(); return cb(err); }
        statusStepOK();

        statusBeginStep('Creating temporary image');
        createImage(opts.title, (megabytes + 24) + 'm', function (err, temporaryImagePath) {
          if (err) { statusStepError(); return cb(err); }
          statusStepOK();

          (function () {
            var originalCallback = cb;
            cb = function () {
              var that = this, args = arguments;
              statusBeginStep('Removing temporary image');
              fs.unlink(temporaryImagePath, function (err) {
                if (err) { statusStepError(); console.error(err); }
                else { statusStepOK(); }
                originalCallback.apply(that, args);
              });
            };
          })();

          statusBeginStep('Mounting temporary image');
          mountImage(temporaryImagePath, function (err, temporaryMountPath) {
            if (err) { statusStepError(); return cb(err); }
            statusStepOK();

            var unmountTemporaryImage = (function () {

              var isMounted = true;
              var originalCallback = cb;

              cb = function () {
                var that = this, args = arguments;
                if(isMounted) {
                  statusBeginStep('Unmounting temporary image');
                  unmountTemporaryImage(function (err) {
                    if (err) { statusStepError(); console.error(err); }
                    else { statusStepOK(); }
                    originalCallback.apply(that, args);
                  });
                } else {
                  originalCallback.apply(that, args);
                }
              };

              return function (cb) {
                if (isMounted) {
                  unmountImage(temporaryMountPath, function (err) {
                    if (!err) { isMounted = false; }
                    return cb(err);
                  });
                } else {
                  cb(null);
                }
              }
            })();

            statusBeginStep('Copying background');
            copyBackground(temporaryMountPath, opts.background, function (err, bkgname) {
              if (err) { statusStepError(); return cb(err); }
              statusStepOK();

              statusBeginStep('Copying application');
              copyApp(temporaryMountPath, opts.app, function (err, appname) {
                if (err) { statusStepError(); return cb(err); }
                statusStepOK();

                statusBeginStep('Creating Applications alias');
                createAlias(temporaryMountPath, function (err, aliname) {
                  if (err) { statusStepError(); return cb(err); }
                  statusStepOK();

                  statusBeginStep('Making all the visuals');
                  makeVisuals(temporaryMountPath, bkgname, appname, opts.title, opts.icons, function (err) {
                    if (err) { statusStepError(); return cb(err); }
                    statusStepOK();

                    statusBeginStep('Unmounting temporary image');
                    unmountTemporaryImage(function (err) {
                      if (err) { statusStepError(); return cb(err); }
                      statusStepOK();

                      statusBeginStep('Finalizing image');
                      convertImage(temporaryImagePath, target, function (err) {
                        if (err) { statusStepError(); return cb(err); }
                        statusStepOK();

                        cb(null);

                      });

                    });

                  });

                });

              });

            });

          });

        });

      });

    });

  });
};

var usage = [
  'Generate beautiful dmg-images for your applications.',
  '',
  'Usage: $0 <json-path> <dmg-path>',
  '',
  'json-path:    JSON Specification path',
  'dmg-path:     DMG Output path'
].join('\n');

var argv = optimist.usage(usage).demand(2).argv;

appdmg(argv._[0], argv._[1], function (err) {
  if (err) {
    process.stderr.write('\n');
    throw err;
  } else {
    process.stderr.write('\r' + 'All done!' + String.repeat(' ', 50) + '\n');
  }
});
