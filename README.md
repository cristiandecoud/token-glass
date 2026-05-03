# Token Glass

A Chrome DevTools extension for inspecting and decoding JWTs in real time. Token Glass automatically captures tokens from network requests and lets you decode, search, compare, and diff them — without leaving DevTools.

![Token Glass panel](icons/icon128.png)

## Features

- **Auto-capture** — detects JWTs in request/response headers and bodies automatically
- **Live decode** — paste any JWT and see header, payload, and signature decoded instantly
- **Claim annotations** — timestamps shown as human-readable dates with relative time; scopes rendered as tags; standard claims explained with tooltips
- **Compare mode** — paste two tokens side by side and see a structured diff of what changed
- **Search** — find any key or value across the decoded output with keyboard navigation
- **Zero data collection** — everything stays local; nothing leaves your browser

## Installation

### From the Chrome Web Store

[![Available in the Chrome Web Store](https://storage.googleapis.com/web-dev-uploads/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/UV4C4ybeBTsZt43U4xis.png)](https://chromewebstore.google.com/detail/token-glass/pnhjafdnkgddffeegbifnfpdifdkpbcd)

### Manual (Developer mode)

1. Clone or download this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the repo folder
5. Open DevTools on any page → **Token Glass** tab

## Development

No build step required — the extension runs directly from source.

```bash
git clone https://github.com/cristiandecoud/token-glass.git
cd token-glass
```

Load the folder as an unpacked extension (see above). After any code change, go to `chrome://extensions` and click the refresh icon on the Token Glass card.

### Project structure

```
token-glass/
├── core/           # Shared logic (JWT parsing, JSON tree renderer, claim metadata)
├── devtools/       # DevTools page registration
├── panel/          # Main UI (HTML, CSS, JS)
├── icons/
├── background.js   # Service worker (context menu, session bridge)
└── manifest.json
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

## License

[MIT](LICENSE) © CDigital Studio
