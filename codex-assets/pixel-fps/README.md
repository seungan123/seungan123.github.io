# Pixel FPS Codex assets

These files are staging assets for the step-by-step Codex rebuild.

- reference.png: current user-supplied visual reference only. Never load it as a page background.
- reference.webp: previous visual reference, retained for history; not used by the home page.
- scene-background.webp: background layer.
- rifle-transparent.webp: rifle/hand layer.

The home page loads the two WebP assets directly from these repository paths as separate decorative layers. UI text, navigation, and cards remain HTML/CSS.

Important: keep UI text/cards as real HTML. Keep the background and rifle as independent layers. Do not add animation until the static layout is approved.
