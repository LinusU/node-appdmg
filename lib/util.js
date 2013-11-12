
var fs = require('fs');
var spawn = require('child_process').spawn;

var StringStream = require('./string-stream');

var wrapCallback = function (cb) {
  return function () {
    cb.apply(this, arguments);
    cb = function () {};
  };
};

exports.sh = function (prog, args, cb) {
  var out = new StringStream();
  var err = new StringStream();
  var child = spawn(prog, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(out);
  child.stderr.pipe(err);
  child.on('exit', function (code) {
    if (code === 0) {
      // FIXME: don't use a stupid setTimeout, ensure pipes are closed...
      setTimeout(function () {
        cb(null, { stdout: out.toString(), stderr: err.toString() });
      }, 400);
    } else {
      cb(new Error('Error running ' + prog + ': #' + code + '\n\n' + err.toString()));
    }
  });
};

exports.cp = function (source, target, cb) {

  var done = wrapCallback(cb);

  var rd = fs.createReadStream(source);
  rd.on('error', function (err) { done(err); });

  var wr = fs.createWriteStream(target);
  wr.on('error', function (err) { done(err); });
  wr.on('finish', function () { done(null); });

  rd.pipe(wr);

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
}
