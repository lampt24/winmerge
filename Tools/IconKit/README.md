# WinMerge Fluent icon kit

Vector sources and generator for WinMerge's icon set and branding bitmaps. The style follows
QuadPane: Fluent-like rounded shapes, the cyan/blue accent palette and clear status colors
(amber = difference, red = conflict/error, green = equal, blue/violet/teal = left/middle/right pane).

All glyphs are drawn on a 32 x 32 grid in `glyphs.js`; branding lives in `branding.js`.
Fills are mid-tone on purpose, because the same bitmaps are shown on light and dark menus/toolbars.

## Regenerate

```sh
cd Tools/IconKit
npm install
node generate.js --preview preview.png   # writes into ../../Src/res and refreshes preview.png
```

`preview.png` (committed) shows every icon on a light and a dark background; regenerate it whenever a glyph changes.
Use `--out <dir>` to write somewhere else instead of `Src/res`.

## What is generated

| Output (in `Src/res`) | Format | Used by |
|---|---|---|
| `ToolbarEnabled32.png` | 29 cells of 64 x 62, RGBA | main toolbar, order = `g_toolbarImageOrder` in `Src/ToolbarButtons.cpp` |
| `*.bmp` (100 files listed in `Merge2.rc`) | 16 x 15, 24-bit, magenta color key | menu item images (BCMenu) |
| `mg_icons.png` / `mg_icons.bmp` | 16 cells of 12 x 12 | editor margin: execution, breakpoints, bookmarks 1–9/0, wrap |
| folder-compare `*.ico` (39 files) | 16/24/32/48 px | DirView status column, compare statistics, filters |
| `Merge.ico`, `MergeDoc.ico`, `MergeDir.ico`, `MergeProject.ico` | 16–256 px | app, document types; also copied to `ShellExtension/Resources` |
| `splash.png` | 1100 x 700 | About dialog background |
| `logo.jpg` / `logo.png` | 336 x 80 | Open view banner |

Not generated (unused by the app, left as is): `ToolbarEnabled8bit.bmp`, the `*12/*13/*23.ico` variants.

Adding a toolbar command means adding its glyph to `T` and its name to `TOOLBAR_ORDER` in the same
position as the command in `g_toolbarImageOrder`.

## Font

`fonts/Inter.ttf` (SIL Open Font License, see `fonts/OFL.txt`) is only used to draw the wordmark into
`splash.png` and `logo.jpg`; it is not shipped with WinMerge.
