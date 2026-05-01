import { renderJsonTree } from '../core/json-tree.js';
import { base64UrlDecode } from '../core/jwt.js';
import { renderDiff } from './diff.js';
import { createSearch } from './search.js';
import { createCapturedPanel } from './captured.js';

// ── Icons ──────────────────────────────────────────────────────
const copyIcon  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

const EXAMPLE_JWT = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImFiYzEyMyJ9.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20iLCJzdWIiOiJ1c2VyXzQyIiwiYXVkIjoiYXBpLmV4YW1wbGUuY29tIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDM2MDAsInNjb3BlIjoicmVhZCB3cml0ZSIsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiYWxpY2VAZXhhbXBsZS5jb20ifQ.signature_placeholder';

const PRIMARY_PLACEHOLDER = '<span class="placeholder">Paste your JWT here...</span>';
const COMPARE_PLACEHOLDER = '<span class="placeholder">Paste second JWT…</span>';

const emptyState = `<div class="empty-state">
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
  <p>Paste a JWT to decode it</p>
  <button class="example-btn" id="loadExampleBtn">Try an example</button>
</div>`;

// ── DOM refs ───────────────────────────────────────────────────
const tokenDisplay    = document.getElementById('tokenDisplay');
const hiddenInput     = document.getElementById('hiddenInput');
const output          = document.getElementById('output');
const clearBtn        = document.getElementById('clearBtn');
const compareSlot     = document.getElementById('compareSlot');
const compareInput    = document.getElementById('compareInput');
const compareDisplay  = document.getElementById('compareDisplay');
const compareClearBtn = document.getElementById('compareClearBtn');
const compareToggleBtn = document.getElementById('compareToggleBtn');

const tabBtns        = document.querySelectorAll('.tab-btn');
const capturedPanel  = document.getElementById('capturedPanel');
const inputPanel     = document.querySelector('.input-panel');
const capturedBadge  = document.getElementById('capturedBadge');
const tokenList      = document.getElementById('tokenList');
const collapseAllBtn    = document.getElementById('collapseAllBtn');
const clearCapturedBtn  = document.getElementById('clearCapturedBtn');
const resizeHandle   = document.getElementById('resizeHandle');

// ── Shared state ───────────────────────────────────────────────
const state = {
  activeTab: 'decode',
  capturedTokens: [],
  newCount: 0,
  selectedId: null,
  expandedInfoIds: new Set(),
  expandedGroupIds: new Set(),
  collapsedGroupIds: new Set(),
  diffSlotAId: null,
  diffSlotBId: null,
};

// ── Helpers ────────────────────────────────────────────────────

function renderJwtColors(el, token, placeholder = PRIMARY_PLACEHOLDER) {
  if (!token) { el.innerHTML = placeholder; return; }
  const parts = token.split('.');
  if (parts.length !== 3) { el.textContent = token; return; }
  el.innerHTML =
    `<span class="part-header">${parts[0]}</span>` +
    `<span class="dot-sep">.</span>` +
    `<span class="part-payload">${parts[1]}</span>` +
    `<span class="dot-sep">.</span>` +
    `<span class="part-sig">${parts[2]}</span>`;
}

function closeCompareSlot() {
  compareInput.value = '';
  renderJwtColors(compareDisplay, '', COMPARE_PLACEHOLDER);
  compareSlot.classList.remove('active');
  compareToggleBtn.textContent = '+ Compare';
  state.diffSlotBId = null;
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  try { return document.execCommand('copy'); } finally { ta.remove(); }
}

// ── Decode ─────────────────────────────────────────────────────

function decode(token) {
  token = token.replace(/\s+/g, '');
  renderJwtColors(tokenDisplay, token);

  if (!token) {
    output.innerHTML = emptyState;
    bindExampleBtn();
    search.sync();
    return;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    output.innerHTML = `<div class="error-state">Invalid JWT — expected 3 dot-separated parts, found ${parts.length}.</div>`;
    search.sync();
    return;
  }

  let header, payload;
  try { header = base64UrlDecode(parts[0]); }
  catch(e) { output.innerHTML = `<div class="error-state">Could not decode header: ${e.message}</div>`; search.sync(); return; }

  try { payload = base64UrlDecode(parts[1]); }
  catch(e) { output.innerHTML = `<div class="error-state">Could not decode payload: ${e.message}</div>`; search.sync(); return; }

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
      <div class="section-content"><div class="json-output">${renderJsonTree(payload)}</div></div>
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
    btn.addEventListener('click', async e => {
      e.preventDefault(); e.stopPropagation();
      const copied = await copyToClipboard(decodeURIComponent(btn.dataset.copy));
      btn.innerHTML = copied ? checkIcon : copyIcon;
      btn.dataset.tooltip = copied ? 'Copied!' : 'Failed';
      setTimeout(() => { btn.innerHTML = copyIcon; btn.dataset.tooltip = 'Copy'; }, 1500);
    });
  });

  search.sync();
}

// ── Output routing ─────────────────────────────────────────────

let diffDebounceId = null;

function renderOutput() {
  const tokenA = hiddenInput.value.trim().replace(/\s+/g, '');
  const tokenB = compareInput.value.trim().replace(/\s+/g, '');
  if (tokenB) {
    renderDiff(output, tokenA, tokenB);
    search.sync();
  } else {
    decode(hiddenInput.value);
  }
}

function autoRenderDiff() {
  if (state.activeTab !== 'decode') return;
  clearTimeout(diffDebounceId);
  diffDebounceId = setTimeout(renderOutput, 200);
}

// ── Diff slots ─────────────────────────────────────────────────

function addToDiffSlot(token, entryId) {
  if (!hiddenInput.value.trim() || state.diffSlotAId === null) {
    // Set as primary (A)
    hiddenInput.value     = token;
    state.diffSlotAId     = entryId;
    state.selectedId      = entryId;
    closeCompareSlot();
    decode(token);
    captured.renderTokenList();
  } else {
    // Set as compare (B)
    compareInput.value = token;
    renderJwtColors(compareDisplay, token, COMPARE_PLACEHOLDER);
    state.diffSlotBId = entryId;
    compareSlot.classList.add('active');
    compareToggleBtn.textContent = '× Compare';
    renderDiff(output, hiddenInput.value.trim().replace(/\s+/g, ''), token);
    search.sync();
    captured.renderTokenList();
  }
}

// ── Tab switching ──────────────────────────────────────────────

function switchToCapturedTab() {
  state.activeTab = 'captured';
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'captured'));
  capturedPanel.classList.add('active');
  inputPanel.classList.add('hidden');
  state.newCount = 0;
  capturedBadge.textContent = '0';
  capturedBadge.classList.remove('visible');
  captured.renderTokenList();
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeTab = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.toggle('active', b === btn));
    capturedPanel.classList.remove('active');
    inputPanel.classList.remove('hidden');
    if (state.activeTab === 'captured') {
      capturedPanel.classList.add('active');
      inputPanel.classList.add('hidden');
      state.newCount = 0;
      capturedBadge.textContent = '0';
      capturedBadge.classList.remove('visible');
      captured.renderTokenList();
    }
  });
});

// ── Primary input events ───────────────────────────────────────

tokenDisplay.addEventListener('click', () => hiddenInput.focus());

hiddenInput.addEventListener('input', () => {
  if (state.selectedId !== null || state.diffSlotAId !== null) {
    state.selectedId  = null;
    state.diffSlotAId = null;
    captured.renderTokenList();
  }
  renderJwtColors(tokenDisplay, hiddenInput.value);
  renderOutput();
});

hiddenInput.addEventListener('paste', e => {
  const pasted = e.clipboardData?.getData('text') ?? '';
  setTimeout(() => {
    if (state.selectedId !== null || state.diffSlotAId !== null) {
      state.selectedId  = null;
      state.diffSlotAId = null;
      captured.renderTokenList();
    }
    renderJwtColors(tokenDisplay, hiddenInput.value || pasted);
    renderOutput();
  }, 0);
});

// ── Compare slot events ────────────────────────────────────────

compareDisplay.addEventListener('click', () => compareInput.focus());

compareInput.addEventListener('input', () => {
  if (state.diffSlotBId !== null) {
    state.diffSlotBId = null;
    captured.renderTokenList();
  }
  renderJwtColors(compareDisplay, compareInput.value.trim(), COMPARE_PLACEHOLDER);
  autoRenderDiff();
});

compareInput.addEventListener('paste', e => {
  const pasted = e.clipboardData?.getData('text') ?? '';
  setTimeout(() => {
    if (state.diffSlotBId !== null) {
      state.diffSlotBId = null;
      captured.renderTokenList();
    }
    renderJwtColors(compareDisplay, (compareInput.value || pasted).trim(), COMPARE_PLACEHOLDER);
    autoRenderDiff();
  }, 0);
});

compareToggleBtn.addEventListener('click', () => {
  const isActive = compareSlot.classList.toggle('active');
  compareToggleBtn.textContent = isActive ? '× Compare' : '+ Compare';
  if (!isActive) {
    compareInput.value = '';
    renderJwtColors(compareDisplay, '', COMPARE_PLACEHOLDER);
    state.diffSlotBId = null;
    renderOutput();
    captured.renderTokenList();
  }
});

compareClearBtn.addEventListener('click', () => {
  closeCompareSlot();
  renderOutput();
  captured.renderTokenList();
});

clearBtn.addEventListener('click', () => {
  hiddenInput.value = '';
  state.selectedId  = null;
  state.diffSlotAId = null;
  closeCompareSlot();
  captured.renderTokenList();
  decode('');
});

// ── Misc ───────────────────────────────────────────────────────

function bindExampleBtn() {
  const btn = document.getElementById('loadExampleBtn');
  if (btn) btn.addEventListener('click', () => {
    hiddenInput.value = EXAMPLE_JWT;
    renderJwtColors(tokenDisplay, EXAMPLE_JWT);
    renderOutput();
  });
}

function loadPendingToken(token) {
  hiddenInput.value = token;
  decode(token);
  state.activeTab = 'decode';
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'decode'));
  capturedPanel.classList.remove('active');
  inputPanel.classList.remove('hidden');
}

// ── Resize handle ──────────────────────────────────────────────

const layoutEl = document.querySelector('.layout');
const narrowMQ = window.matchMedia('(max-width: 560px)');
let isResizing = false;

resizeHandle.addEventListener('mousedown', e => {
  isResizing = true;
  resizeHandle.classList.add('dragging');
  document.body.style.cursor = narrowMQ.matches ? 'row-resize' : 'col-resize';
  document.body.style.userSelect = 'none';
  e.preventDefault();
});

document.addEventListener('mousemove', e => {
  if (!isResizing) return;
  const panel = state.activeTab === 'captured' ? capturedPanel : inputPanel;
  const rect  = layoutEl.getBoundingClientRect();
  if (narrowMQ.matches) {
    const h = Math.max(80, Math.min(rect.height - 80, e.clientY - rect.top));
    panel.style.maxHeight = `${h}px`;
    panel.style.minHeight = `${h}px`;
  } else {
    const w = Math.max(160, Math.min(rect.width - 160, e.clientX - rect.left));
    panel.style.width = `${w}px`;
  }
});

document.addEventListener('mouseup', () => {
  if (!isResizing) return;
  isResizing = false;
  resizeHandle.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

narrowMQ.addEventListener('change', () => {
  [inputPanel, capturedPanel].forEach(p => {
    p.style.width = '';
    p.style.minHeight = '';
    p.style.maxHeight = '';
  });
});

// ── Incoming tokens ────────────────────────────────────────────

window.receiveToken = function(entry) {
  state.capturedTokens.push(entry);
  if (state.activeTab === 'captured') {
    captured.renderTokenList();
  } else {
    state.newCount++;
    capturedBadge.textContent = state.newCount;
    capturedBadge.classList.add('visible');
  }
};

window.receiveTokens = function(entries) {
  state.capturedTokens = [...entries];
  if (entries.length > 0) {
    switchToCapturedTab();
  } else if (state.activeTab === 'captured') {
    captured.renderTokenList();
  }
};

window.receiveNavigated = function(url) {
  state.capturedTokens.push({ _separator: true, url, id: Math.random().toString(36).slice(2), timestamp: Date.now() });
  if (state.activeTab === 'captured') captured.renderTokenList();
};

// ── Init ───────────────────────────────────────────────────────

const search = createSearch({
  output,
  input:    document.getElementById('searchInput'),
  count:    document.getElementById('searchCount'),
  prevBtn:  document.getElementById('searchPrevBtn'),
  nextBtn:  document.getElementById('searchNextBtn'),
  closeBtn: document.getElementById('searchCloseBtn'),
});

const captured = createCapturedPanel(
  { tokenList, capturedBadge, collapseAllBtn, clearCapturedBtn },
  state,
  { hiddenInput, closeCompareSlot, renderOutput, addToDiffSlot },
);

output.innerHTML = emptyState;
bindExampleBtn();
captured.renderTokenList();

// ── Claim info tooltip (fixed-position, escapes overflow clips) ─

const claimTooltip = document.createElement('div');
claimTooltip.id = 'claimTooltip';
document.body.appendChild(claimTooltip);

let tooltipHideTimer = null;

document.addEventListener('mouseover', e => {
  const icon = e.target.closest('.claim-info');
  if (!icon) return;
  clearTimeout(tooltipHideTimer);
  const text = icon.dataset.tooltip;
  if (!text) return;
  claimTooltip.textContent = text;
  claimTooltip.style.opacity = '0';
  claimTooltip.style.display = 'block';

  const iconRect = icon.getBoundingClientRect();
  const tipRect  = claimTooltip.getBoundingClientRect();
  let left = iconRect.left + iconRect.width / 2 - tipRect.width / 2;
  let top  = iconRect.top - tipRect.height - 7;

  // clamp horizontally inside viewport
  left = Math.max(6, Math.min(left, window.innerWidth - tipRect.width - 6));
  // if not enough room above, flip below
  if (top < 6) top = iconRect.bottom + 7;

  claimTooltip.style.left = `${left}px`;
  claimTooltip.style.top  = `${top}px`;
  claimTooltip.style.opacity = '1';
});

document.addEventListener('mouseout', e => {
  const icon = e.target.closest('.claim-info');
  if (!icon) return;
  tooltipHideTimer = setTimeout(() => {
    claimTooltip.style.opacity = '0';
  }, 80);
});

// ── Footer links ────────────────────────────────────────────────

const REPO_URL  = 'https://github.com/cristiandecoud/token-glass';
const ISSUE_URL = 'https://github.com/cristiandecoud/token-glass/issues/new';
const PRIVACY_URL = 'https://github.com/cristiandecoud/token-glass/blob/main/PRIVACY_POLICY.md';

document.getElementById('footerGithub').addEventListener('click', () => window.open(REPO_URL));
document.getElementById('footerBug').addEventListener('click',    () => window.open(ISSUE_URL));
document.getElementById('footerPrivacy').addEventListener('click', () => window.open(PRIVACY_URL));

// ── Context menu (background → session storage → panel) ────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.pendingToken) {
    const { token } = changes.pendingToken.newValue;
    loadPendingToken(token);
    chrome.storage.session.remove('pendingToken');
  }
});
