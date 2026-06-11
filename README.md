# Mousewho

Mousewho is a Manifest V3 browser extension for fast keyboard-only browsing with Vim-style keys. It avoids persistent overlays and only scans the visible page when link hints are requested.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and choose this repository.

## Load in Firefox

1. Run `npm run build:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and choose `dist/firefox/manifest.json`.

## Keys

| Key | Action |
| --- | --- |
| `j` / `k` | Scroll down / up |
| `h` / `l` | Scroll left / right |
| `d` / `u` | Half-page down / up |
| `gg` / `G` | Top / bottom of page |
| `f` | Show fast hints and click the selected target |
| `F` | Show hints and open the selected link in a background tab |
| `J` / `K` | Previous / next tab |
| `i` | Focus first visible text input and enter insert mode |
| `?` | Show in-page help |
| `Esc` / `Ctrl-[` | Exit hints/help or blur focused input from insert mode |

## Performance approach

- Normal scrolling and navigation are direct keydown handlers with no page scans.
- Link/button hinting is lazy: Mousewho scans only when `f`/`F` is pressed.
- Candidate collection uses one selector query, filters to visible targets, caps rendered hints, and builds DOM markers in a `DocumentFragment`.
- Overlays live in a contained Shadow DOM host with `pointer-events: none` for hints.
- Synthetic benchmark coverage tracks hint label generation and prefix filtering latency.

## Development

```sh
npm test
npm run build:firefox
npm run benchmark
```

The Chrome extension has no runtime build step. The Firefox build copies shared source files into `dist/firefox` with a Firefox-specific manifest. There are no npm dependencies.
