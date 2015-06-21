function convert (src) {
  var obj = {}

  obj.title = src.title
  obj.icon = src.icon
  obj.background = src.background

  obj['icon-size'] = src.icons.size

  obj.contents = [
    { x: src.icons.alias[0], y: src.icons.alias[1], type: 'link', path: '/Applications' },
    { x: src.icons.app[0], y: src.icons.app[1], type: 'file', path: src.app }
  ]

  var extra = (src.extra || [])
  extra.forEach(function (e) {
    obj.contents.push({
      x: e[1],
      y: e[2],
      type: 'file',
      path: e[0]
    })
  })

  return obj
}

exports.convert = convert
