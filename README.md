# node-appdmg

Generate beautiful DMG-images for your OS X applications.

## Installation

```sh
npm install -g appdmg
```

## Usage

```sh
appdmg <json-path> <dmg-path>
```

- `json-path`: Path to the JSON Specification file
- `dmg-path`:  Path at which to place the final DMG

## Test

To produce a test DMG to your desktop, run the following command:

```sh
appdmg test/appdmg.json ~/Desktop/test.dmg
```

## JSON Specification

![Visualization](/help/help.png?raw=true)

The specification for the image is a simple json file, example provided
below. All paths are relative to the json-file's path. (Comments are not
allowed, I'm only using them for demonstration purposes.)

```javascript
{

  // The title of the produced DMG, which will be shown when mounted
  "title": "Test Title",

  // Path to your icon, which will be shown when mounted
  "icon": "TestIcon.icns",

  // Path to your background
  "background": "TestBkg.png",

  // Size of all the icons inside the DMG
  "icon-size": 80,

  "contents": [

    // This is the contents of your DMG.

    // Each entry has a position specified by
    // X and Y in the center of its icon.

    // `type: link` creates a link to the specified target
    { "x": 448, "y": 344, "type": "link", "path": "/Applications" },

    // `type: file` adds a file to the DMG
    { "x": 192, "y": 344, "type": "file", "path": "TestApp.app" },
    { "x": 512, "y": 128, "type": "file", "path": "TestDoc.txt" }

  ]

}
```

`0.1.x` used a different format on the specification. This format is still
supported but deprecated, please update your json.

### Retina background

Finder can display retina backgrounds if packaged correctly into a `.tiff`
file. `appdmg` will do this for you automatically if it can find a file
with the same name as the background appended with `@2x`.

E.g. if the json contains `"background": "TestBkg.png"` then add a file
with the name `TestBkg@2x.png` into the same folder.

## API

The application can also be called from within
another javascript file, example:

```javascript

var appdmg = require('appdmg');
var ee = appdmg('test/appdmg.json', 'test.dmg');

ee.on('progress', function (info) {

  // info.current is the current step
  // info.total is the total number of steps
  // info.type is on of 'step-begin', 'step-end'

  // 'step-begin'
  // info.title is the title of the current step

  // 'step-end'
  // info.status is one of 'ok', 'skip', 'fail'

});

ee.on('finish', function () {
  // There now is a `test.dmg` file
});

ee.on('error', function (err) {
  // An error occurred
});

```

## OS Support

Currently the only supported os is Mac OS X.

Track the status of this here: https://github.com/LinusU/node-appdmg/issues/14
