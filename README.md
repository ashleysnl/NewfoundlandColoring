# Color Cove (GitHub Pages Ready)

Color Cove is a static, touch-first coloring app optimized for iOS Safari and Home Screen usage.

## Why this engine
This app uses **raster flood-fill with an offscreen line mask** (Option 2) because the provided artwork is image-based (PNG/WEBP), not native layered SVG regions. The engine is optimized for tap-to-fill with:
- precomputed line barriers
- zoom-aware coordinate conversion
- undo/redo image history
- per-page persistent progress in `localStorage`

## UX upgrades included
- Visual gallery grid with progress state per page.
- Dedicated editor screen with fixed top bar and fixed floating bottom dock.
- True pinch-to-zoom + pan on artwork only.
- Double-tap zoom toggle (`1x` fit <-> `2.5x`) plus `+`, `-`, and Reset View buttons.
- Tap-to-fill works correctly at any zoom level (inverse transform math).
- Always-visible current color + large palette swatches + recent colors + custom picker.
- Undo/Redo/Clear/Save with large touch targets.
- iOS-friendly safe-area padding and touch behavior.
- Offline support after first load via Service Worker caching.
- One-time Add to Home Screen helper modal.

## Folder structure
- `index.html`
- `styles.css`
- `app.js`
- `zoom.js`
- `storage.js`
- `pages/pages.json`
- `manifest.json`
- `sw.js`
- `icons/icon.svg`
- `icons/maskable.svg`
- `Assets/...` (source and optimized artwork files)

## Deploy to GitHub Pages
1. Push this folder to your repository root (or `docs/` if your Pages config uses that).
2. In GitHub: **Settings -> Pages**.
3. Source:
   - Branch: `main` (or your default branch)
   - Folder: `/ (root)` or `/docs` (match where files live)
4. Save settings and wait for deploy.
5. Open your Pages URL and hard-refresh once.

## Local testing
```bash
cd "/Users/AshleySkinner/Documents/00_Engineering/04_Code/30_Coloring App"
python3 -m http.server 8081
```
Then open `http://localhost:8081`.

## iOS Safari + Add to Home Screen tips
- Open in Safari, tap **Share**, then **Add to Home Screen**.
- Relaunch from Home Screen to use standalone mode.
- Pinch, pan, and double-tap work inside the artwork viewport without scrolling the page.

## Accessibility notes
- Touch targets are at least 44px for main controls.
- Buttons have clear `aria-label`s.
- Keyboard shortcuts in editor:
  - `+` / `-` for zoom in/out
  - `0` reset view
  - `Cmd/Ctrl + Z` undo, `Cmd/Ctrl + Shift + Z` redo
  - `Esc` back to gallery
