import { escapeHtml, renderJsonTree } from './json-tree.js';

const copyIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

const EXAMPLE_JWT = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImFiYzEyMyJ9.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20iLCJzdWIiOiJ1c2VyXzQyIiwiYXVkIjoiYXBpLmV4YW1wbGUuY29tIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDM2MDAsInNjb3BlIjoicmVhZCB3cml0ZSIsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiYWxpY2VAZXhhbXBsZS5jb20ifQ.signature_placeholder';

const emptyState = `<div class="empty-state">
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
  <p>Paste a JWT to decode it</p>
  <button class="example-btn" id="loadExampleBtn">Try an example</button>
</div>`;

const tokenDisplay = document.getElementById('tokenDisplay');
const hiddenInput = document.getElementById('hiddenInput');
const output = document.getElementById('output');
const clearBtn = document.getElementById('clearBtn');
const searchInput = document.getElementById('searchInput');
const searchCount = document.getElementById('searchCount');
const searchPrevBtn = document.getElementById('searchPrevBtn');
const searchNextBtn = document.getElementById('searchNextBtn');
const searchCloseBtn = document.getElementById('searchCloseBtn');

// --- Tab switching ---
const tabBtns = document.querySelectorAll('.tab-btn');
const capturedPanel = document.getElementById('capturedPanel');
const inputPanel = document.querySelector('.input-panel');
const capturedBadge = document.getElementById('capturedBadge');
const tokenList = document.getElementById('tokenList');
const clearCapturedBtn = document.getElementById('clearCapturedBtn');

let activeTab = 'decode';
let capturedTokens = [];
let newCount = 0;
let selectedId = null;
let expandedInfoIds = new Set();
let expandedGroupIds = new Set();
let searchQuery = '';
let searchMatches = [];
let activeSearchIndex = -1;
let autoOpenedDetails = new Set();
let searchDebounceId = null;
const SEARCH_DEBOUNCE_MS = 120;

function switchToCapturedTab() {
  activeTab = 'captured';
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'captured'));
  capturedPanel.classList.add('active');
  inputPanel.classList.add('hidden');
  newCount = 0;
  capturedBadge.textContent = '0';
  capturedBadge.classList.remove('visible');
  renderTokenList();
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.toggle('active', b === btn));
    if (activeTab === 'captured') {
      capturedPanel.classList.add('active');
      inputPanel.classList.add('hidden');
      newCount = 0;
      capturedBadge.textContent = '0';
      capturedBadge.classList.remove('visible');
      renderTokenList();
    } else {
      capturedPanel.classList.remove('active');
      inputPanel.classList.remove('hidden');
    }
  });
});

function relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function isExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp && payload.exp * 1000 < Date.now();
  } catch { return false; }
}


function getSourceSideLabel(entry) {
  if (entry.sourceSide === 'request') return '→ REQ';
  if (entry.sourceSide === 'response') return '← RES';
  return 'SOURCE';
}

function getMethodClass(method) {
  const m = (method || '').toUpperCase();
  if (m === 'GET')    return 'method-get';
  if (m === 'POST')   return 'method-post';
  if (m === 'PUT')    return 'method-put';
  if (m === 'PATCH')  return 'method-patch';
  if (m === 'DELETE') return 'method-delete';
  return 'method-other';
}

function getStatusClass(status) {
  if (!status) return '';
  if (status >= 200 && status < 300) return 'status-2xx';
  if (status >= 300 && status < 400) return 'status-3xx';
  if (status >= 400 && status < 500) return 'status-4xx';
  return 'status-5xx';
}

function shortPath(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 35 ? '…' + u.pathname.slice(-33) : u.pathname;
    return u.hostname + path;
  } catch { return url.slice(0, 45); }
}

function buildRenderItems(tokens) {
  const items = [];
  const currentGroups = new Map();
  const groupOrder = [];

  function flushGroups() {
    for (const key of groupOrder) {
      items.push({ type: 'group', ...currentGroups.get(key) });
    }
    currentGroups.clear();
    groupOrder.length = 0;
  }

  for (const entry of tokens) {
    if (entry._separator) {
      flushGroups();
      items.push({ type: 'separator', url: entry.url });
      continue;
    }
    // Each unique requestId = one network request = one group.
    // Fallback to entry.id so tokens without requestId each get their own group.
    const key = entry.requestId ?? entry.id;
    if (!currentGroups.has(key)) {
      currentGroups.set(key, {
        groupId: key,
        url: entry.url,
        method: entry.method,
        status: entry.status,
        statusText: entry.statusText,
        mimeType: entry.mimeType,
        timestamp: entry.timestamp,
        entries: [],
      });
      groupOrder.push(key);
    }
    currentGroups.get(key).entries.push(entry);
  }
  flushGroups();
  return items;
}

function getSourceKindLabel(entry) {
  if (entry.sourceKind === 'header') return 'Header';
  if (entry.sourceKind === 'query') return 'Query';
  if (entry.sourceKind === 'body') return 'Body';
  return 'Unknown';
}

function getSourcePropertyLabel(entry) {
  if (entry.sourceName) return entry.sourceName;
  return entry.source || '—';
}

function shortValue(value, max = 42) {
  if (value === undefined || value === null || value === '') return '—';
  const normalized = Array.isArray(value) ? value.join(', ') : String(value);
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function formatCapturedAt(ts) {
  return new Date(ts).toLocaleString();
}

function getTokenInsights(token) {
  try {
    const [headerPart, payloadPart] = token.split('.');
    const header = base64UrlDecode(headerPart);
    const payload = base64UrlDecode(payloadPart);
    return {
      alg: header.alg,
      kid: header.kid,
      typ: header.typ,
      iss: payload.iss,
      sub: payload.sub,
      aud: payload.aud,
      exp: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : null,
      scope: payload.scope,
      azp: payload.azp,
    };
  } catch {
    return {};
  }
}

function renderInfoRow(label, value, className = '') {
  return `<div class="token-detail-row${className ? ` ${className}` : ''}">
    <span class="token-detail-label">${escapeHtml(label)}</span>
    <span class="token-detail-value">${escapeHtml(value ?? '—')}</span>
  </div>`;
}

function renderGroupInfo(group) {
  const statusText = group.status
    ? `${group.status}${group.statusText ? ` ${group.statusText}` : ''}`
    : '—';
  return `<div class="token-detail-panel group-detail-panel">
    ${renderInfoRow('Endpoint', group.url, 'full-width')}
    ${renderInfoRow('Method', group.method || '—')}
    ${renderInfoRow('Status', statusText)}
    ${renderInfoRow('Mime', group.mimeType || '—')}
    ${renderInfoRow('Captured at', formatCapturedAt(group.timestamp))}
  </div>`;
}

function renderTokenClaims(entry) {
  const details = getTokenInsights(entry.token);
  const rows = [
    details.alg && renderInfoRow('alg', shortValue(details.alg)),
    details.kid && renderInfoRow('kid', shortValue(details.kid)),
    details.iss && renderInfoRow('iss', shortValue(details.iss)),
    details.sub && renderInfoRow('sub', shortValue(details.sub)),
    details.aud && renderInfoRow('aud', shortValue(details.aud)),
    details.exp && renderInfoRow('exp', shortValue(details.exp)),
  ].filter(Boolean);

  if (!rows.length) return '';
  return `<div class="token-detail-panel token-claims-panel">${rows.join('')}</div>`;
}

function renderTokenItem(entry) {
  const expired = isExpired(entry.token);
  const selected = entry.id === selectedId ? 'selected' : '';
  const expanded = expandedInfoIds.has(entry.id);
  return `<div class="token-item ${selected} ${expanded ? 'info-open' : ''}">
    <div class="token-row" data-id="${entry.id}">
      <div class="token-row-info">
        <div class="token-row-source">
          <span class="source-badge source-${entry.sourceSide || 'unknown'}">${escapeHtml(getSourceSideLabel(entry))}</span>
          <span class="source-path">${escapeHtml(getSourceKindLabel(entry))} · <strong class="source-name">${escapeHtml(getSourcePropertyLabel(entry))}</strong></span>
        </div>
      </div>
      <div class="token-row-meta">
        <span class="token-row-time">${relativeTime(entry.timestamp)}</span>
        ${expired ? '<span class="expired-badge">EXPIRED</span>' : ''}
        <button class="token-info-btn" data-action="toggle-info" data-id="${entry.id}">${expanded ? 'Hide' : 'Info'}</button>
      </div>
    </div>
    ${expanded ? renderTokenClaims(entry) : ''}
  </div>`;
}

function renderTokenList() {
  if (capturedTokens.length === 0) {
    tokenList.innerHTML = `<div class="captured-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <p>Make network requests and JWTs will appear here automatically</p>
    </div>`;
    return;
  }

  const items = buildRenderItems(capturedTokens);

  tokenList.innerHTML = items.map(item => {
    if (item.type === 'separator') {
      return `<div class="nav-separator">↪ ${escapeHtml(item.url)}</div>`;
    }
    const { groupId, url, method, status, entries } = item;
    const count = entries.length;
    const groupExpanded = expandedGroupIds.has(groupId);
    return `<div class="endpoint-group">
      <div class="endpoint-group-header">
        ${method ? `<span class="method-badge ${getMethodClass(method)}">${escapeHtml(method)}</span>` : ''}
        <span class="endpoint-path">${escapeHtml(shortPath(url))}</span>
        ${status ? `<span class="status-badge ${getStatusClass(status)}">${status}</span>` : ''}
        <span class="endpoint-token-count">${count} token${count !== 1 ? 's' : ''}</span>
        <button class="group-info-btn" data-group-id="${escapeHtml(groupId)}">${groupExpanded ? 'Hide' : 'Details'}</button>
      </div>
      ${groupExpanded ? renderGroupInfo(item) : ''}
      <div class="endpoint-group-tokens">
        ${entries.map(e => renderTokenItem(e)).join('')}
      </div>
    </div>`;
  }).join('');

  tokenList.querySelectorAll('.token-row[data-id]').forEach(row => {
    row.addEventListener('click', () => {
      const entry = capturedTokens.find(t => t.id === row.dataset.id);
      if (!entry) return;
      selectedId = entry.id;
      hiddenInput.value = entry.token;
      decode(entry.token);
      renderTokenList();
    });
  });

  tokenList.querySelectorAll('.group-info-btn[data-group-id]').forEach(button => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const gid = button.dataset.groupId;
      if (expandedGroupIds.has(gid)) {
        expandedGroupIds.delete(gid);
      } else {
        expandedGroupIds.add(gid);
      }
      renderTokenList();
    });
  });

  tokenList.querySelectorAll('.token-info-btn[data-id]').forEach(button => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = button.dataset.id;
      if (expandedInfoIds.has(id)) {
        expandedInfoIds.delete(id);
      } else {
        expandedInfoIds.add(id);
      }
      renderTokenList();
    });
  });
}

// Relative time updater
setInterval(() => {
  if (activeTab === 'captured') renderTokenList();
}, 30_000);

// --- Public API called by devtools.js via panelWindow ---
window.receiveToken = function(entry) {
  capturedTokens.push(entry);
  if (activeTab === 'captured') {
    renderTokenList();
  } else {
    newCount++;
    capturedBadge.textContent = newCount;
    capturedBadge.classList.add('visible');
  }
};

window.receiveTokens = function(entries) {
  capturedTokens = [...entries];
  if (entries.length > 0) {
    switchToCapturedTab();
  } else if (activeTab === 'captured') {
    renderTokenList();
  }
};

window.receiveNavigated = function(url) {
  capturedTokens.push({ _separator: true, url, id: Math.random().toString(36).slice(2), timestamp: Date.now() });
  if (activeTab === 'captured') renderTokenList();
};

clearCapturedBtn.addEventListener('click', () => {
  capturedTokens = [];
  selectedId = null;
  expandedInfoIds = new Set();
  expandedGroupIds = new Set();
  newCount = 0;
  capturedBadge.textContent = '0';
  capturedBadge.classList.remove('visible');
  renderTokenList();
  hiddenInput.value = '';
  decode('');
  // Tell devtools.js to clear its buffer so tokens don't reappear
  if (window.clearBuffer) window.clearBuffer();
});

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return JSON.parse(atob(str));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // Fall through to the legacy copy path in restricted extension contexts.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

function updateSearchControls() {
  const hasQuery = searchQuery.trim().length > 0;
  const hasMatches = searchMatches.length > 0;
  searchCount.textContent = hasQuery
    ? `${hasMatches ? activeSearchIndex + 1 : 0}/${searchMatches.length}`
    : '0/0';
  searchPrevBtn.disabled = !hasMatches;
  searchNextBtn.disabled = !hasMatches;
}

function restoreAutoOpenedDetails() {
  autoOpenedDetails.forEach(detail => {
    if (detail.isConnected) detail.open = false;
  });
  autoOpenedDetails = new Set();
}

function clearSearchHighlights() {
  output.querySelectorAll('.search-hit').forEach(mark => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });

  restoreAutoOpenedDetails();
  searchMatches = [];
  activeSearchIndex = -1;
  updateSearchControls();
}

function openAncestorDetails(node) {
  let current = node.parentElement;
  while (current) {
    if (current.tagName === 'DETAILS' && !current.open) {
      current.open = true;
      autoOpenedDetails.add(current);
    }
    current = current.parentElement;
  }
}

function isVisibleTextNode(node) {
  let current = node.parentElement;

  while (current && current !== output) {
    const style = getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }
    current = current.parentElement;
  }

  const parent = node.parentElement;
  return Boolean(parent && parent.getClientRects().length > 0);
}

function collectSearchableTextNodes() {
  const walker = document.createTreeWalker(output, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('.copy-btn, .search-bar, .search-count, script, style, textarea')) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!isVisibleTextNode(node)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  let current;
  while ((current = walker.nextNode())) {
    nodes.push(current);
  }
  return nodes;
}

function applySearch(query) {
  searchQuery = query;
  clearSearchHighlights();

  const normalized = query.trim();
  if (!normalized) {
    return;
  }

  const matcher = new RegExp(escapeRegExp(normalized), 'gi');

  collectSearchableTextNodes().forEach(node => {
    const text = node.nodeValue;
    matcher.lastIndex = 0;
    let match = matcher.exec(text);
    if (!match) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    while (match) {
      const start = match.index;
      const end = start + match[0].length;

      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }

      const mark = document.createElement('mark');
      mark.className = 'search-hit';
      mark.textContent = text.slice(start, end);
      fragment.appendChild(mark);
      searchMatches.push(mark);

      lastIndex = end;
      match = matcher.exec(text);
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    node.parentNode.replaceChild(fragment, node);
  });

  searchMatches.forEach(openAncestorDetails);

  if (searchMatches.length > 0) {
    activeSearchIndex = 0;
    focusSearchMatch(0);
  } else {
    updateSearchControls();
  }
}

function focusSearchMatch(index) {
  if (!searchMatches.length) {
    activeSearchIndex = -1;
    updateSearchControls();
    return;
  }

  if (index < 0) index = searchMatches.length - 1;
  if (index >= searchMatches.length) index = 0;

  searchMatches.forEach(match => match.classList.remove('active'));
  activeSearchIndex = index;

  const activeMatch = searchMatches[index];
  activeMatch.classList.add('active');
  activeMatch.scrollIntoView({ block: 'center', behavior: 'smooth' });
  updateSearchControls();
}

function openSearchBar() {
  searchInput.focus();
  searchInput.select();
  updateSearchControls();
}

function closeSearchBar() {
  searchInput.value = '';
  searchQuery = '';
  clearSearchHighlights();
  searchInput.focus();
}

function syncSearchWithOutput() {
  if (searchQuery.trim()) {
    applySearch(searchQuery);
  } else {
    clearSearchHighlights();
  }
}

function addTimestampAnnotations(payload) {
  const copy = { ...payload };
  ['exp', 'iat', 'nbf'].forEach(field => {
    if (copy[field]) {
      copy[`${field}_human`] = new Date(copy[field] * 1000).toLocaleString();
    }
  });
  return copy;
}

function renderTokenColors(token) {
  if (!token) {
    tokenDisplay.innerHTML = '<span class="placeholder">Paste your JWT here...</span>';
    return;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    tokenDisplay.textContent = token;
    return;
  }
  tokenDisplay.innerHTML =
    `<span class="part-header">${parts[0]}</span>` +
    `<span class="dot-sep">.</span>` +
    `<span class="part-payload">${parts[1]}</span>` +
    `<span class="dot-sep">.</span>` +
    `<span class="part-sig">${parts[2]}</span>`;
}

function decode(token) {
  token = token.replace(/\s+/g, '');
  renderTokenColors(token);

  if (!token) {
    output.innerHTML = emptyState;
    bindExampleBtn();
    syncSearchWithOutput();
    return;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    output.innerHTML = `<div class="error-state">Invalid JWT — expected 3 dot-separated parts, found ${parts.length}.</div>`;
    syncSearchWithOutput();
    return;
  }

  let header, payload;
  try { header = base64UrlDecode(parts[0]); }
  catch(e) {
    output.innerHTML = `<div class="error-state">Could not decode header: ${e.message}</div>`;
    syncSearchWithOutput();
    return;
  }

  try { payload = base64UrlDecode(parts[1]); }
  catch(e) {
    output.innerHTML = `<div class="error-state">Could not decode payload: ${e.message}</div>`;
    syncSearchWithOutput();
    return;
  }

  const annotated = addTimestampAnnotations(payload);

  output.innerHTML = `
    <div class="section">
      <div class="section-header header-label">
        <span class="dot"></span> Header
        <button class="copy-btn" data-tooltip="Copy" data-copy="${encodeURIComponent(JSON.stringify(header, null, 2))}">${copyIcon}</button>
      </div>
      <div class="section-content"><div class="json-output">${renderJsonTree(header)}</div></div>
    </div>
    <div class="section">
      <div class="section-header payload-label">
        <span class="dot"></span> Payload
        <button class="copy-btn" data-tooltip="Copy" data-copy="${encodeURIComponent(JSON.stringify(payload, null, 2))}">${copyIcon}</button>
      </div>
      <div class="section-content"><div class="json-output">${renderJsonTree(annotated)}</div></div>
    </div>
    <div class="section">
      <div class="section-header sig-label">
        <span class="dot"></span> Signature
        <button class="copy-btn" data-tooltip="Copy" data-copy="${encodeURIComponent(parts[2])}">${copyIcon}</button>
      </div>
      <div class="section-content"><div class="sig-value">${parts[2]}</div></div>
    </div>
  `;

  output.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const copied = await copyToClipboard(decodeURIComponent(btn.dataset.copy));
      btn.innerHTML = copied ? checkIcon : copyIcon;
      btn.dataset.tooltip = copied ? 'Copied!' : 'Failed';
      setTimeout(() => {
        btn.innerHTML = copyIcon;
        btn.dataset.tooltip = 'Copy';
      }, 1500);
    });
  });

  syncSearchWithOutput();
}

// The colored div acts as display; the hidden textarea captures paste/input
tokenDisplay.addEventListener('click', () => hiddenInput.focus());

hiddenInput.addEventListener('input', () => decode(hiddenInput.value));
hiddenInput.addEventListener('paste', (e) => {
  const pasted = e.clipboardData?.getData('text') ?? '';
  setTimeout(() => decode(hiddenInput.value || pasted), 0);
});

searchInput.addEventListener('input', () => {
  if (searchDebounceId) {
    clearTimeout(searchDebounceId);
  }

  searchDebounceId = setTimeout(() => {
    searchDebounceId = null;
    applySearch(searchInput.value);
  }, SEARCH_DEBOUNCE_MS);
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    focusSearchMatch(activeSearchIndex + (event.shiftKey ? -1 : 1));
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeSearchBar();
  }
});

searchPrevBtn.addEventListener('click', () => {
  focusSearchMatch(activeSearchIndex - 1);
});

searchNextBtn.addEventListener('click', () => {
  focusSearchMatch(activeSearchIndex + 1);
});

searchCloseBtn.addEventListener('click', () => {
  closeSearchBar();
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    openSearchBar();
  }
});

clearBtn.addEventListener('click', () => {
  hiddenInput.value = '';
  decode('');
});

output.innerHTML = emptyState;
bindExampleBtn();
renderTokenList();

function bindExampleBtn() {
  const btn = document.getElementById('loadExampleBtn');
  if (btn) btn.addEventListener('click', () => {
    hiddenInput.value = EXAMPLE_JWT;
    decode(EXAMPLE_JWT);
  });
}

// Context menu → storage → panel
function loadPendingToken(token) {
  hiddenInput.value = token;
  decode(token);
  // Switch to Decode tab so the output is visible
  activeTab = 'decode';
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'decode'));
  capturedPanel.classList.remove('active');
  inputPanel.classList.remove('hidden');
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.pendingToken) {
    const { token } = changes.pendingToken.newValue;
    loadPendingToken(token);
    chrome.storage.session.remove('pendingToken');
  }
});

// Pick up token set before the panel was open
chrome.storage.session.get('pendingToken', (result) => {
  if (result.pendingToken) {
    loadPendingToken(result.pendingToken.token);
    chrome.storage.session.remove('pendingToken');
  }
});
