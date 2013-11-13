
var fs = require('fs');
var path = require('path');
var applescript = require('applescript');

var util = require('./util');
var hdiutil = require('./hdiutil');

var statusBeginStep = (function () {
  var n = 0;
  return function (title) {
    var line = '[' + (n < 9 ? ' ' : '') + (++n) + '/14] ' + title + '...';
    process.stderr.write(line + String.repeat(' ', 45 - line.length))
  };
})();
var statusStepError = function () {
  process.stderr.write('[FAIL]\n');
};
var statusStepOK = function () {
  process.stderr.write('[ OK ]\n');
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

var copyIcon = function (dirname, icon, cb) {

  var finalPath = path.join(dirname, '.VolumeIcon.icns');

  util.cp(icon, finalPath, function (err) {
    if (err) { return cb(err); }

    util.sh('SetFile', ['-a', 'C', dirname], function (err) {
      cb(err, ( err ? undefined : finalPath ));
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

var blessImage = function (path, cb) {
  args = [];
  args.push('--folder', path);
  args.push('--openfolder', path);
  util.sh('bless', args, cb);
};

var makeVisuals = function (dirname, bkgname, appname, volname, icons, cb) {
  fs.readFile(__dirname + '/visuals.applescript', function (err, buffer) {
    if (err) { return cb(err); }

    var table = {
      'rootpath': dirname,
      'window.bounds': '{100, 100, 740, 580}',
      'icons.size': icons.size,
      'app.name': appname,
      'app.position': '{' + icons.app.join(', ') + '}',
      'alias.name': 'Applications',
      'alias.position': '{' + icons.alias.join(', ') + '}',
      'background.location': bkgname.replace(/\//g, ':')
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

        // FIXME: I think that this has something to do
        // with blocksize and minimum file size...
        // This should work for now but requires more
        // space than it should. Note that this does
        // not effect the final image.
        megabytes = megabytes * 1.5;

        statusBeginStep('Creating temporary image');
        hdiutil.create(opts.title, (megabytes + 32) + 'm', function (err, temporaryImagePath) {
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
          hdiutil.attach(temporaryImagePath, function (err, temporaryMountPath) {
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
                hdiutil.detach(temporaryMountPath, function (err) {
                  if (!err) { isMounted = false; }
                  return cb(err);
                });
              }
            })();

            statusBeginStep('Copying background');
            copyBackground(temporaryMountPath, opts.background, function (err, bkgname) {
              if (err) { statusStepError(); return cb(err); }
              statusStepOK();

              statusBeginStep('Copying icon');
              copyIcon(temporaryMountPath, opts.icon, function (err) {
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

                      statusBeginStep('Blessing image');
                      blessImage(temporaryMountPath, function (err) {
                        if (err) { statusStepError(); return cb(err); }
                        statusStepOK();

                        statusBeginStep('Unmounting temporary image');
                        unmountTemporaryImage(function (err) {
                          if (err) { statusStepError(); return cb(err); }
                          statusStepOK();

                          statusBeginStep('Finalizing image');
                          hdiutil.convert(temporaryImagePath, target, function (err) {
                            if (err) { statusStepError(); return cb(err); }
                            statusStepOK();

                            cb(null, target);

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

    });

  });

};

module.exports = exports = appdmg;
