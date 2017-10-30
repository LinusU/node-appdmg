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
appdmg test/assets/appdmg.json ~/Desktop/test.dmg
```

## JSON Input

![Visualization](/help/help.png?raw=true)

The JSON input for the image follows a simple structure. All paths are relative to
the JSON file's path.

### Example

```json
{
  "title": "Test Application",
  "icon": "test-app.icns",
  "background": "test-background.png",
  "contents": [
    { "x": 448, "y": 344, "type": "link", "path": "/Applications" },
    { "x": 192, "y": 344, "type": "file", "path": "TestApp.app" }
  ]
}
```

### Specification

+ `title` (string, required) - The title of the produced DMG, which will be shown when mounted
+ `icon` (string, optional) - Path to your icon, which will be shown when mounted
+ `background` (string, optional) - Path to your background
+ `background-color` (string, optional) - Background color (accepts css colors)
+ `icon-size` (number, optional) - Size of all the icons inside the DMG
+ `window` (object, optional) - Window options
    + `position` (object, optional) - Position when opened
        + `x` (number, required) - X position relative to left of the screen
        + `y` (number, required) - Y position relative to bottom of the screen
    + `size` (object, optional) - Window size
        + `width` (number, required) - Window width
        + `height` (number, required) - Window height
+ `format` (enum[string], optional) - Disk image format
    + `UDRW` - UDIF read/write image
    + `UDRO` - UDIF read-only image
    + `UDCO` - UDIF ADC-compressed image
    + `UDZO` - UDIF zlib-compressed image
    + `UDBZ` - UDIF bzip2-compressed image (OS X 10.4+ only)
    + `ULFO` - UDIF lzfse-compressed image (OS X 10.11+ only)
+ `contents` (array[object], required) - This is the contents of your DMG.
    + `x` (number, required) - X position relative to icon center
    + `y` (number, required) - Y position relative to icon center
    + `type` (enum[string], required)
        + `link` - Creates a link to the specified target
        + `file` - Adds a file to the DMG
        + `position` - Positions a present file
    + `path` (string, required) - Path to the file
    + `name` (string, optional) - Name of the file within the DMG
+ `code-sign` (object, optional) - Options for codesigning the DMG
  + `signing-identity` (string, required) - The identity with which to sign the resulting DMG
  + `identifier` (string, optional) - Explicitly set the unique identifier string that is embedded in code signatures

`0.1.x` used a different JSON format. This format is still supported but
deprecated, please update your json.

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

const appdmg = require('appdmg');
const ee = appdmg({ source: 'test/appdmg.json', target: 'test.dmg' });

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

You can also pass in the specification directly instead of reading it from a file. `basepath` should be a path which will be used to resolve other paths in the specification.

```javascript
const ee = appdmg({
  target: 'test.dmg',
  basepath: __dirname,
  specification: {
    "title": "Test Title",
    // ...
  }
});
```

## OS Support

Currently the only supported os is Mac OS X.

Track the status of this here: https://github.com/LinusU/node-appdmg/issues/14

## Hidden files

By default hidden files will show for users with `com.apple.finder AppleShowAllFiles`
set to `TRUE`. This can be worked around by moving all hidden files outside the initial
window size (using `"type": "position"`), this has the side-effect of enabling a scrollbar.

Files to usually move:

- `.background`
- `.DS_Store`
- `.Trashes`
- `.VolumeIcon.icns`

## Alternatives

* [create-dmg](https://github.com/andreyvit/create-dmg/blob/master/README.md), a Bash script
* [dmgbuild](https://pypi.python.org/pypi/dmgbuild), a Python version
