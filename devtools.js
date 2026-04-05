const JWT_RE = /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g;
const MAX_BODY_SCAN = 100_000;
const MAX_BUFFER = 100;

const buffer = [];
const seen = new Set();
let panelWindow = null;

function extractJWTs(text, url, meta = {}) {
  const matches = text.match(JWT_RE);
  if (!matches) return;
  for (const token of matches) {
    const key = token + '|' + url;
    if (seen.has(key)) continue;
    seen.add(key);

    // Validate it's actually decodable before buffering
    try {
      const parts = token.split('.');
      JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (_) {
      continue;
    }

    const entry = { id: Math.random().toString(36).slice(2), token, url, timestamp: Date.now(), ...meta };
    if (buffer.length >= MAX_BUFFER) buffer.shift();
    buffer.push(entry);
    if (panelWindow) panelWindow.receiveToken(entry);
  }
}

chrome.devtools.network.onRequestFinished.addListener((req) => {
  const url = req.request.url;
  const requestMeta = {
    requestId: Math.random().toString(36).slice(2),
    method: req.request.method,
    status: req.response.status,
    statusText: req.response.statusText,
    mimeType: req.response.content?.mimeType ?? '',
  };

  // 1. Request headers
  for (const h of req.request.headers) {
    if (h.value && h.value.length > 10) {
      extractJWTs(h.value, url, { ...requestMeta, sourceSide: 'request', sourceKind: 'header', sourceName: h.name });
    }
  }

  // 2. Response headers
  for (const h of req.response.headers) {
    if (h.value && h.value.length > 10) {
      extractJWTs(h.value, url, { ...requestMeta, sourceSide: 'response', sourceKind: 'header', sourceName: h.name });
    }
  }

  // 3. URL query params
  extractJWTs(url, url, { ...requestMeta, sourceSide: 'request', sourceKind: 'query', sourceName: 'URL parameter' });

  // 4. Response body (async) — field-aware for JSON responses
  req.getContent((body) => {
    if (!body || body.length === 0) return;
    const scan = body.slice(0, MAX_BODY_SCAN);

    // Extract JWTs with their JSON field names (e.g. access_token, refresh_token)
    const fieldRe = /"([^"]{1,64})":\s*"(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})"/g;
    let fieldMatch;
    while ((fieldMatch = fieldRe.exec(scan)) !== null) {
      extractJWTs(fieldMatch[2], url, { ...requestMeta, sourceSide: 'response', sourceKind: 'body', sourceName: fieldMatch[1] });
    }

    // Generic fallback for JWTs not wrapped in a JSON key-value pair
    // (the `seen` set in extractJWTs deduplicates overlap with field matches above)
    extractJWTs(scan, url, { ...requestMeta, sourceSide: 'response', sourceKind: 'body', sourceName: 'response body' });
  });
});

chrome.devtools.network.onNavigated.addListener((newUrl) => {
  if (panelWindow) panelWindow.receiveNavigated(newUrl);
});

function clearBufferData() {
  buffer.length = 0;
  seen.clear();
}

let panelInitialized = false;

chrome.devtools.panels.create('Token Glass', 'icons/icon16.png', 'panel.html', (panel) => {
  panel.onShown.addListener((win) => {
    panelWindow = win;
    panelWindow.clearBuffer = clearBufferData;
    if (!panelInitialized) {
      panelInitialized = true;
      if (buffer.length > 0) panelWindow.receiveTokens(buffer);
    }
  });
  panel.onHidden.addListener(() => {
    panelWindow = null;
  });
});
