'use strict'

function convert (src) {
  const obj = {}

  obj.title = src.title
  obj.icon = src.icon
  obj.background = src.background

  obj['icon-size'] = src.icons.size

  obj.contents = [
    { x: src.icons.alias[0], y: src.icons.alias[1], type: 'link', path: '/Applications' },
    { x: src.icons.app[0], y: src.icons.app[1], type: 'file', path: src.app }
  ]

  for (const extra of (src.extra || [])) {
    obj.contents.push({
      x: extra[1],
      y: extra[2],
      type: 'file',
      path: extra[0]
    })
  }

  return obj
}

exports.convert = convert
