# 📷 Photo Filters

[![Test and deploy](https://github.com/mchamow/photo-filters/actions/workflows/deploy.yml/badge.svg)](https://github.com/mchamow/photo-filters/actions/workflows/deploy.yml)

**Day 22 of [100 Days of React](https://github.com/mchamow?tab=repositories)**: Tune photos with sliders and presets, right in the browser.

**Live demo:** https://mchamow.github.io/photo-filters/

## Features

- **Open a photo** with the file picker, by dropping it anywhere on the page, or by pasting it; a built-in sample image loads on a first visit
- **Nine adjustments** in three groups: brightness, contrast, fade · saturation, warmth, hue · sepia, vignette, blur. Each value doubles as a reset button
- **Nine presets** (Original, Vivid, Warm, Cool, Matte, Vintage, Mono, Noir, Dreamy), with thumbnails rendered from your own photo
- **Live RGB + luminance histogram** of the edited photo
- **Rotate and flip**; rotating a mirrored photo still turns what you see
- **Compare**: a before/after split you drag across the photo (or move with the arrow keys), or hold a button or <kbd>B</kbd> to see the original
- **Undo / redo**: one slider drag is one step, not hundreds
- **Download** the edit at full size (up to 2048 px) as PNG or JPEG
- The photo, the edit and the format are saved in `localStorage`, so a reload picks up where you left off. Nothing is uploaded anywhere
- Light and dark themes, works on a 360px phone
- **Keyboard shortcuts**: <kbd>1</kbd>–<kbd>9</kbd> presets · <kbd>R</kbd> / <kbd>Shift</kbd>+<kbd>R</kbd> rotate · <kbd>H</kbd> / <kbd>V</kbd> flip · <kbd>C</kbd> compare · hold <kbd>B</kbd> for the original · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> redo · <kbd>Ctrl</kbd>+<kbd>O</kbd> open · <kbd>Ctrl</kbd>+<kbd>S</kbd> download (<kbd>⌘</kbd> on a Mac)

## How it works

The filters run on raw pixels in plain TypeScript, so every step is unit-tested without a canvas:

- [`src/pixels.ts`](src/pixels.ts): orientation (rotate + mirror), a three-pass box blur that approximates a Gaussian, and the histogram
- [`src/adjust.ts`](src/adjust.ts): every colour adjustment is an affine colour matrix; they are composed into one 3×4 matrix, so each pixel costs nine multiplications whatever the settings. Then the vignette
- [`src/history.ts`](src/history.ts): the undo/redo reducer, which merges consecutive changes from the same slider into one step
- [`src/image.ts`](src/image.ts): the only part that touches the canvas: decoding files into pixels and encoding the result

The sliders re-render a ~1 MP preview through `useDeferredValue`, and the download renders the full-size image once.

## Tech

React 19 · TypeScript · Vite · Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Base UI) · lucide icons · Vitest + Testing Library · deployed to GitHub Pages with GitHub Actions.

## Run locally

```bash
pnpm install
pnpm dev
pnpm test   # 67 unit and component tests (Vitest)
```
