
var fs = require('fs');
var temp = require('temp');
var util = require('./util');

exports.convert = function (source, target, cb) {
  var args = [];
  args.push('convert', source);
  args.push('-format', 'UDZO');
  args.push('-imagekey', 'zlib-level=9');
  args.push('-o', target);
  util.sh('hdiutil', args, function (err) {
    if (err) {
      fs.unlink(target, function () {
        cb(err);
      });
    } else {
      cb(null, target);
    }
  });
};

exports.create = function (volname, size, cb) {
  var args = [];
  var outname = temp.path({ suffix: '.dmg' });
  args.push('create', outname);
  args.push('-fs', 'HFS+');
  args.push('-size', size);
  args.push('-volname', volname);
  util.sh('hdiutil', args, function (err) {
    if (err) {
      fs.unlink(outname, function () {
        cb(err);
      });
    } else {
      cb(null, outname);
    }
  });
};

exports.attach = function (path, cb) {
  var args = [], m;
  args.push('attach', path);
  args.push('-nobrowse');
  args.push('-noverify');
  args.push('-noautoopen');
  util.sh('hdiutil', args, function (err, res) {
    if (err) { return cb(err); }

    m = /Apple_HFS\s+(.*)\s*$/.exec(res.stdout);
    if (m === null) {
      cb(new Error('Failed to mount image'));
    } else {
      cb(null, m[1]);
    }

  });
};

exports.detach = function (path, cb) {
  var args = [];
  args.push('detach', path);
  util.sh('hdiutil', args, function (err) {
    if (err && err.exitCode === 16 && /Resource busy/.test(err.stderr)) {
      setTimeout(function () {
        util.sh('hdiutil', args, function (err) { cb(err); });
      }, 1000);
    } else {
      cb(err);
    }
  });
};
