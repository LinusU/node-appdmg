#!/usr/bin/env node

process.title = 'appdmg'

var path = require('path')
var minimist = require('minimist')
var pkg = require('../package.json')
var appdmg = require('../index.js')
var colors = require('../lib/colors')
var repeatString = require('repeat-string')

function maybeWithColor (color, text) {
  if (!process.stderr.isTTY) return text

  return colors[color](colors, text)
}

process.on('uncaughtException', function (err) {
  if (!argv.quiet) {
    process.stderr.write('\n')
  }

  if (argv === undefined || argv.verbose) {
    process.stderr.write(err.stack + '\n\n')
  }

  process.stderr.write(maybeWithColor('red', err.name + ': ' + err.message) + '\n')
  process.exit(1)
})

var usage = [
  'Generate beautiful dmg-images for your OS X applications.',
  '',
  'Usage: appdmg <json-path> <dmg-path>',
  '',
  'json-path:  Path to the JSON Specification file',
  'dmg-path:   Path at which to place the final dmg',
  '',
  'Options:',
  '',
  '-v, --verbose',
  '    Verbose error output',
  '',
  '--quiet',
  '    Suppresses progress output',
  '',
  '--help',
  '    Display usage and exit',
  '',
  '--version',
  '    Display version and exit',
  ''
].join('\n')

var argv = minimist(process.argv.slice(2), {
  boolean: [ 'verbose', 'quiet', 'help', 'version' ],
  alias: { v: 'verbose' }
})

if (argv.version) {
  process.stderr.write('node-appdmg v' + pkg.version + '\n')
  process.exit(0)
}

if (argv.help || argv._.length < 2) {
  process.stderr.write(usage + '\n')
  process.exit(0)
}

if (argv._.length > 2) {
  throw new Error('Too many arguments')
}

if (path.extname(argv._[0]) !== '.json') {
  throw new Error('Input must have the .json file extension')
}

if (path.extname(argv._[1]) !== '.dmg') {
  throw new Error('Output must have the .dmg file extension')
}

var source = argv._[0]
var target = argv._[1]
var p = appdmg({ source: source, target: target })

p.on('progress', function (info) {
  if (argv.quiet) return

  if (info.type === 'step-begin') {
    var line = '[' + (info.current <= 9 ? ' ' : '') + info.current + '/' + info.total + '] ' + info.title + '...'
    process.stderr.write(line + repeatString(' ', 45 - line.length))
  }

  if (info.type === 'step-end') {
    var op = ({
      ok: ['green', ' OK '],
      skip: ['yellow', 'SKIP'],
      error: ['red', 'FAIL']
    }[info.status])

    process.stderr.write('[' + maybeWithColor(op[0], op[1]) + ']\n')
  }
})

p.on('finish', function () {
  if (argv.quiet) return

  process.stderr.write('\n' + maybeWithColor('green', 'Your image is ready:') + '\n' + target + '\n')
})
