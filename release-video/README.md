# Google Chat AI Gateway Reply Demo Video

HyperFrames source and rendered assets for a short release video showing AI replying inside Google Chat.

## Composition

- Source: `index.html`
- Size: 1920 x 1080
- Duration: 16 seconds
- Logo asset: `assets/yourbright-footer-logo.png`
- Main image assets:
  - `image/google-chat-ai-gateway-hero.png`
  - `image/google-chat-ai-gateway-built-for-teams.png`
  - `image/google-chat-ai-gateway-how-it-works.png`

## Intended Render

```bash
npx hyperframes lint
npx hyperframes inspect --samples 12
npx hyperframes preview --port 3017
npx hyperframes render --output google-chat-ai-gateway-reply-demo.mp4 --quality standard
```

This local environment currently has Node but not `npm`/`npx` on PATH, so the HyperFrames CLI could not be run here.

## Generated Preview Video

Because the HyperFrames CLI was unavailable, `record-preview.cjs` records the browser playback as a fallback:

```bash
node record-preview.cjs
```

Generated file:

- `renders/google-chat-ai-gateway-reply-demo.mp4`
- `renders/google-chat-ai-gateway-reply-demo.webm`
- `renders/google-chat-ai-gateway-reply-demo-preview.png`

The Playwright-bundled ffmpeg in this environment can record WebM, but it does not include MP4 encoding/muxing support. A full static ffmpeg build can be placed under `tools/` for MP4 conversion; that directory is ignored by git.
