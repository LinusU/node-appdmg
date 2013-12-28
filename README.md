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

  // Path to your .app
  "app": "TestApp.app",

  // Path to your background
  "background": "TestBkg.png",

  // Path to your icon, which will be shown when mounted
  "icon": "TestIcon.icns",

  // Size and position of the icons in the DMG
  // Positions are specified as X and Y in the center of said icon
  // "app" is your application
  // "alias" is an alias to the Applications folder
  "icons": {
    "size": 80,
    "app": [192, 344],
    "alias": [448, 344]
  }

}
```

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

appdmg('test/appdmg.json', 'test.dmg', function (err, path) {
  // err is an potential error
  // path is the path to the final DMG
});

```

## OS Support

Currently the only supported os is Mac OS X.

Supporing other operating systems would involve writing a custom
`.DS_Store` writer, but if accomplished would bring improvements
even to the Mac platform since we could drop all the apple script
stuff which currently adds ~15 seconds to the build time and pops
up the Finder.
