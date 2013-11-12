
var path = require('path');
var optimist = require('optimist');
var appdmg = require('./lib/appdmg');

var usage = [
  'Generate beautiful dmg-images for your applications.',
  '',
  'Usage: $0 <json-path> <dmg-path>',
  '',
  'json-path:    JSON Specification path',
  'dmg-path:     DMG Output path'
].join('\n');

var argv = optimist.usage(usage).demand(2).argv;

if (path.extname(argv._[0]) !== '.json') {
  throw new Error('Input must have the .json file extension');
}

if (path.extname(argv._[1]) !== '.dmg') {
  throw new Error('Output must have the .dmg file extension');
}

appdmg(argv._[0], argv._[1], function (err, res) {
  if (err) {
    process.stderr.write('\n');
    throw err;
  } else {
    process.stderr.write('Your image is ready:\n' + res + '\n');
  }
});
