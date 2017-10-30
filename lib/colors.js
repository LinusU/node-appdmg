'use strict'

const reset = '\u001b[0m'
const colors = {
  black: '\u001b[0;30m',
  red: '\u001b[0;31m',
  green: '\u001b[0;32m',
  yellow: '\u001b[0;33m',
  blue: '\u001b[0;34m',
  purple: '\u001b[0;35m',
  cyan: '\u001b[0;36m',
  white: '\u001b[0;37m'
}

for (const key of Object.keys(colors)) {
  exports[key] = function (text) {
    return `${colors[key]}${text}${reset}`
  }
}
