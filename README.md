# Mousewho

Mousewho is a Manifest V3 Chrome extension for fast keyboard-only browsing with Vim-style keys. It avoids persistent overlays and only scans the visible page when link hints are requested.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and choose this repository.

## Keys

| Key | Action |
| --- | --- |
| `j` / `k` | Scroll down / up |
| `h` / `l` | Scroll left / right |
| `d` / `u` | Half-page down / up |
| `gg` / `G` | Top / bottom of page |
| `f` | Show fast hints and click the selected target |
| `F` | Show hints and open the selected link in a background tab |
| `H` / `L` | Browser history back / forward |
| `J` / `K` | Previous / next tab |
| `r` | Reload tab |
| `o` / `O` | Open URL/search in current tab / new tab |
| `/` | Lightweight find-in-page prompt |
| `i` | Focus first visible text input |
| `?` | Show in-page help |
| `Esc` | Exit the current Mousewho mode |

Chrome does not expose an extension API to focus the omnibox directly. Use Chrome's native `Ctrl+L` / `⌘L`, or Mousewho's `o` prompt for the same keyboard-first navigation flow.

## Performance approach

- Normal scrolling and navigation are direct keydown handlers with no page scans.
- Link/button hinting is lazy: Mousewho scans only when `f`/`F` is pressed.
- Candidate collection uses one selector query, filters to visible targets, caps rendered hints, and builds DOM markers in a `DocumentFragment`.
- Overlays live in a contained Shadow DOM host with `pointer-events: none` for hints.
- Synthetic benchmark coverage tracks hint label generation and prefix filtering latency.

## Development

```sh
npm test
npm run benchmark
```

The extension has no runtime build step and no npm dependencies.
