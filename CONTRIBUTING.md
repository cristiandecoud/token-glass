# Contributing to Token Glass

Thanks for taking the time to contribute.

## Getting started

1. Fork the repo and clone it locally
2. Load it as an unpacked extension in Chrome (Developer mode → Load unpacked)
3. Make your changes — no build step needed, the extension runs directly from source
4. Reload the extension in `chrome://extensions` after each change

## Reporting bugs

Open an issue using the **Bug report** template. Include the Token Glass version (visible in `chrome://extensions`), Chrome version, and steps to reproduce.

## Suggesting features

Open an issue using the **Feature request** template. Describe the problem you're trying to solve, not just the solution — it helps evaluate the best approach.

## Submitting a pull request

- Keep PRs focused — one change per PR is easier to review
- Test manually in Chrome before submitting
- Fill out the PR template
- For significant changes, open an issue first so we can discuss the approach

## Project structure

```
token-glass/
├── core/           # Shared logic: JWT parsing, JSON renderer, claim metadata
│   ├── jwt.js
│   ├── json-tree.js
│   └── claims.js
├── devtools/       # DevTools page (registers the panel)
├── panel/          # Main UI
│   ├── panel.html
│   ├── panel.css
│   └── panel.js
├── background.js   # Service worker
└── manifest.json
```

## Code style

- Vanilla JS, no frameworks or bundlers
- Prefer small focused functions
- Match the style of the surrounding code
