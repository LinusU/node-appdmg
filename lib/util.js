
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var StringStream = require('./string-stream');

var wrapCallback = function (cb) {
  return function () {
    cb.apply(this, arguments);
    cb = function () {};
  };
};

exports.sh = function (prog, args, cb) {
  var outStream = new StringStream();
  var errStream = new StringStream();
  var child = spawn(prog, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(outStream);
  child.stderr.pipe(errStream);
  child.on('error', function (err) {
    cb(err);
  });
  child.on('exit', function (code) {
    if (code === 0) {
      // FIXME: don't use a stupid setTimeout, ensure pipes are closed...
      setTimeout(function () {
        cb(null, { stdout: outStream.toString(), stderr: errStream.toString() });
      }, 400);
    } else {
      var err = new Error('Error running `' + prog + '`! Exit code was ' + code);
      err.exitCode = code;
      err.stdout = outStream.toString();
      err.stderr = errStream.toString();
      cb(err);
    }
  });
};

exports.cp = function (source, target, cb) {

  var done = wrapCallback(cb);

  var rd = fs.createReadStream(source);
  rd.on('error', function (err) { done(err); });

  rd.on('open', function () {

    var wr = fs.createWriteStream(target);
    wr.on('error', function (err) { done(err); });
    wr.on('finish', function () { done(null); });

    rd.pipe(wr);

  });

};

exports.dusm = function (dirname, cb) {
  exports.sh('du', ['-sm', dirname], function (err, res) {

    if (err) {
      return cb(err);
    }

    if (res.stderr.length > 0) {
      return cb(new Error('du -sm: ' + res.stderr));
    }

    m = /^([0-9]+)\t/.exec(res.stdout);
    if (m === null) {
      console.log(res.stdout);
      return cb(new Error('du -sm: Unknown error'));
    }

    return cb(null, parseInt(m[1]));
  });
};

exports.tiffutil = function (a, b, out, cb) {
  exports.sh('tiffutil', ['-cathidpicheck', a, b, '-out', out], function (err) { cb(err); });
};

var seticonflagbin = path.join(__dirname, '..', 'set-icon-flag', 'seticonflag');
exports.seticonflag = function (path, cb) {
  exports.sh(seticonflagbin, [path], function (err) { cb(err); });
};

// From the php.js project
String.repeat = function (input, multiplier) {
  // http://kevin.vanzonneveld.net
  // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +   improved by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
  // +   improved by: Ian Carter (http://euona.com/)
  // *     example 1: str_repeat('-=', 10);
  // *     returns 1: '-=-=-=-=-=-=-=-=-=-='

  var y = '';
  while (true) {
    if (multiplier & 1) {
      y += input;
    }
    multiplier >>= 1;
    if (multiplier) {
      input += input;
    }
    else {
      break;
    }
  }
  return y;
};
