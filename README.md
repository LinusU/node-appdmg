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
  ],
  "license": [
    {
      "body": [
        {
          "lang": "en-US",
          "text": "This is an example license agreement."
        },
        {
          "lang": "fr-FR",
          "text": "Ceci est un exemple de contrat de licence."
        }
      ]
    }
  ]
}
```

### Specification

- `title` (string, required) - The title of the produced DMG, which will be shown when mounted
- `icon` (string, optional) - Path to your icon, which will be shown when mounted
- `background` (string, optional) - Path to your background
- `background-color` (string, optional) - Background color (accepts css colors)
- `icon-size` (number, optional) - Size of all the icons inside the DMG
- `window` (object, optional) - Window options
  - `position` (object, optional) - Position when opened
    - `x` (number, required) - X position relative to left of the screen
    - `y` (number, required) - Y position relative to bottom of the screen
  - `size` (object, optional) - Window size
    - `width` (number, required) - Window width
    - `height` (number, required) - Window height
- `format` (enum[string], optional) - Disk image format
    - `UDRW` - UDIF read/write image
    - `UDRO` - UDIF read-only image
    - `UDCO` - UDIF ADC-compressed image
    - `UDZO` - UDIF zlib-compressed image
    - `UDBZ` - UDIF bzip2-compressed image (OS X 10.4+ only)
    - `ULFO` - UDIF lzfse-compressed image (OS X 10.11+ only)
- `contents` (array[object], required) - This is the contents of your DMG.
    - `x` (number, required) - X position relative to icon center
    - `y` (number, required) - Y position relative to icon center
    - `type` (enum[string], required)
      - `link` - Creates a link to the specified target
      - `file` - Adds a file to the DMG
      - `position` - Positions a present file
    - `path` (string, required) - Path to the file
    - `name` (string, optional) - Name of the file within the DMG
- `license` (object, optional) - License agreement to add to the DMG ([see detailed documentation](https://github.com/argv-minus-one/dmg-license/blob/master/docs/License%20Specifications.md))
  - `body` (array[object], required) - Localized license texts
    - `lang` (string or integer or array[string or integer], required) - Language(s) of this localization of the license agreement
      - Can be an [IETF language tag](https://en.wikipedia.org/wiki/IETF_language_tag), a classic Mac OS [language code](https://github.com/phracker/MacOSX-SDKs/blob/aea47c83334af9c27dc57c49ca268723ef5e6349/MacOSX10.6.sdk/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/CarbonCore.framework/Versions/A/Headers/Script.h#L285), or an array of them
      - See [full list of supported language tags](https://github.com/argv-minus-one/dmg-license/blob/master/docs/Supported%20Language%20Tags.md)
    - `text` or `file` (string, required) - Text of the license agreement in the given `lang`, or the path to the file containing the text
    - `charset` (string, optional, default: UTF-8) - Character set of the `file`
    - `type` (enum[string], optional)
      - `plain` - License body is plain text
      - `rtf` - License body is RTF
      - If omitted, this defaults to `rtf` if `file` ends with `.rtf`, otherwise `plain`
  - `labels` (array[object], optional) - Localized label strings for the license agreement window
    - `lang` (string or integer or array[string or integer], required) - Language(s) of this label set
    - `localizedName` (string, optional) - Localized name of this language
    - `agree` (string, required) - “Agree” button label
    - `disagree` (string, required) - “Disagree” button label
    - `print` (string, required) - “Print” button label
    - `save` (string, required) - “Save” button label
    - `message` (string, required) - Brief instructions for the user
  - `rawLabels` (array[object], optional) - Localized label strings for the license agreement window, in [raw binary format](https://github.com/argv-minus-one/dmg-license/blob/master/docs/Raw%20labels%20format.md)
    - `lang` (string or integer or array[string or integer], required) - Language(s) of this label set
    - `file` (string, required) - File containing the label strings
  - `defaultLang` (string or integer, optional, default: first `lang` of first `body`) - Default language to use if there is no license localization in the user's preferred language
- `code-sign` (object, optional) - Options for codesigning the DMG
  - `signing-identity` (string, required) - The identity with which to sign the resulting DMG
  - `identifier` (string, optional) - Explicitly set the unique identifier string that is embedded in code signatures

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

- [create-dmg](https://github.com/andreyvit/create-dmg/blob/master/README.md), a Bash script
- [dmgbuild](https://pypi.python.org/pypi/dmgbuild), a Python version
