import { escapeHtml } from '../core/json-tree.js';
import { base64UrlDecode } from '../core/jwt.js';

// ── Pure helpers ───────────────────────────────────────────────

function relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function isExpired(token) {
  try {
    const payload = base64UrlDecode(token.split('.')[1]);
    return payload.exp && payload.exp * 1000 < Date.now();
  } catch { return false; }
}

function getSourceSideLabel(entry) {
  if (entry.sourceSide === 'request') return '→ REQ';
  if (entry.sourceSide === 'response') return '← RES';
  return 'SOURCE';
}

function getSourceKindLabel(entry) {
  if (entry.sourceKind === 'header') return 'Header';
  if (entry.sourceKind === 'query') return 'Query';
  if (entry.sourceKind === 'body') return 'Body';
  return 'Unknown';
}

function getSourcePropertyLabel(entry) {
  return entry.sourceName || '—';
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
    const header  = base64UrlDecode(token.split('.')[0]);
    const payload = base64UrlDecode(token.split('.')[1]);
    return {
      alg: header.alg, kid: header.kid,
      iss: payload.iss, sub: payload.sub, aud: payload.aud,
      exp: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : null,
    };
  } catch { return {}; }
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
  const d = getTokenInsights(entry.token);
  const rows = [
    d.alg && renderInfoRow('alg', shortValue(d.alg)),
    d.kid && renderInfoRow('kid', shortValue(d.kid)),
    d.iss && renderInfoRow('iss', shortValue(d.iss)),
    d.sub && renderInfoRow('sub', shortValue(d.sub)),
    d.aud && renderInfoRow('aud', shortValue(d.aud)),
    d.exp && renderInfoRow('exp', shortValue(d.exp)),
  ].filter(Boolean);
  if (!rows.length) return '';
  return `<div class="token-detail-panel token-claims-panel">${rows.join('')}</div>`;
}

export function buildRenderItems(tokens) {
  const items = [];
  const groups = new Map();
  const order = [];

  function flushGroups() {
    for (const key of order) items.push({ type: 'group', ...groups.get(key) });
    groups.clear();
    order.length = 0;
  }

  for (const entry of tokens) {
    if (entry._separator) {
      flushGroups();
      items.push({ type: 'separator', url: entry.url });
      continue;
    }
    const key = entry.requestId ?? entry.id;
    if (!groups.has(key)) {
      groups.set(key, {
        groupId: key,
        url: entry.url,
        method: entry.method,
        status: entry.status,
        statusText: entry.statusText,
        mimeType: entry.mimeType,
        timestamp: entry.timestamp,
        entries: [],
      });
      order.push(key);
    }
    groups.get(key).entries.push(entry);
  }
  flushGroups();
  return items;
}

// ── Panel factory ──────────────────────────────────────────────

/**
 * @param {{ tokenList: Element, capturedBadge: Element, collapseAllBtn: Element, clearCapturedBtn: Element }} dom
 * @param {{ activeTab: string, capturedTokens: Array, selectedId: string|null, diffSlotAId: string|null, diffSlotBId: string|null, expandedInfoIds: Set, expandedGroupIds: Set, collapsedGroupIds: Set, newCount: number }} state
 * @param {{ hiddenInput: HTMLTextAreaElement, closeCompareSlot: () => void, renderOutput: () => void, addToDiffSlot: (token: string, id: string) => void }} callbacks
 */
export function createCapturedPanel(dom, state, callbacks) {
  const { tokenList, capturedBadge, collapseAllBtn, clearCapturedBtn } = dom;
  const { hiddenInput, closeCompareSlot, renderOutput, addToDiffSlot } = callbacks;

  function renderTokenItem(entry) {
    const expired  = isExpired(entry.token);
    const selected = entry.id === state.selectedId ? 'selected' : '';
    const expanded = state.expandedInfoIds.has(entry.id);
    const badge    = state.diffSlotAId === entry.id
      ? '<span class="diff-slot-badge diff-badge-a">A</span>'
      : state.diffSlotBId === entry.id
        ? '<span class="diff-slot-badge diff-badge-b">B</span>'
        : '';

    return `<div class="token-item ${selected} ${expanded ? 'info-open' : ''}">
      <div class="token-row" data-id="${entry.id}">
        <div class="token-row-info">
          <div class="token-row-source">
            <span class="source-badge source-${entry.sourceSide || 'unknown'}">${escapeHtml(getSourceSideLabel(entry))}</span>
            <span class="source-path">${escapeHtml(getSourceKindLabel(entry))} · <strong class="source-name">${escapeHtml(getSourcePropertyLabel(entry))}</strong></span>
          </div>
        </div>
        <div class="token-row-meta">
          <span class="token-row-time" data-ts="${entry.timestamp}">${relativeTime(entry.timestamp)}</span>
          ${expired ? '<span class="expired-badge">EXPIRED</span>' : ''}
          <button class="token-info-btn" data-id="${entry.id}">${expanded ? 'Hide' : 'Info'}</button>
          ${badge}
          <button class="token-diff-btn" data-id="${entry.id}">Diff</button>
        </div>
      </div>
      ${expanded ? renderTokenClaims(entry) : ''}
    </div>`;
  }

  function renderTokenList() {
    if (state.capturedTokens.length === 0) {
      tokenList.innerHTML = `<div class="captured-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p>Make network requests and JWTs will appear here automatically</p>
      </div>`;
      return;
    }

    const items = buildRenderItems(state.capturedTokens);

    tokenList.innerHTML = items.map(item => {
      if (item.type === 'separator') {
        return `<div class="nav-separator">↪ ${escapeHtml(item.url)}</div>`;
      }
      const { groupId, url, method, status, entries } = item;
      const count = entries.length;
      const groupExpanded   = state.expandedGroupIds.has(groupId);
      const tokensCollapsed = state.collapsedGroupIds.has(groupId);
      return `<div class="endpoint-group">
        <div class="endpoint-group-header">
          <button class="group-collapse-btn" data-collapse-id="${escapeHtml(groupId)}" title="${tokensCollapsed ? 'Show tokens' : 'Hide tokens'}">${tokensCollapsed ? '▶' : '▼'}</button>
          ${method ? `<span class="method-badge ${getMethodClass(method)}">${escapeHtml(method)}</span>` : ''}
          <span class="endpoint-path">${escapeHtml(shortPath(url))}</span>
          ${status ? `<span class="status-badge ${getStatusClass(status)}">${status}</span>` : ''}
          <span class="endpoint-token-count">${count} token${count !== 1 ? 's' : ''}</span>
          <button class="group-info-btn" data-group-id="${escapeHtml(groupId)}">${groupExpanded ? 'Hide' : 'Details'}</button>
        </div>
        ${groupExpanded ? renderGroupInfo(item) : ''}
        ${tokensCollapsed ? '' : `<div class="endpoint-group-tokens">
          ${entries.map(e => renderTokenItem(e)).join('')}
        </div>`}
      </div>`;
    }).join('');

    // Token row — view single token
    tokenList.querySelectorAll('.token-row[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        const entry = state.capturedTokens.find(t => t.id === row.dataset.id);
        if (!entry) return;
        state.selectedId  = entry.id;
        state.diffSlotAId = entry.id;
        hiddenInput.value = entry.token;
        closeCompareSlot();
        renderOutput();
        renderTokenList();
      });
    });

    // Group collapse toggle
    tokenList.querySelectorAll('.group-collapse-btn[data-collapse-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const gid = btn.dataset.collapseId;
        if (state.collapsedGroupIds.has(gid)) state.collapsedGroupIds.delete(gid);
        else state.collapsedGroupIds.add(gid);
        renderTokenList();
      });
    });

    // Group info toggle
    tokenList.querySelectorAll('.group-info-btn[data-group-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const gid = btn.dataset.groupId;
        if (state.expandedGroupIds.has(gid)) state.expandedGroupIds.delete(gid);
        else state.expandedGroupIds.add(gid);
        renderTokenList();
      });
    });

    // Token info toggle
    tokenList.querySelectorAll('.token-info-btn[data-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const id = btn.dataset.id;
        if (state.expandedInfoIds.has(id)) state.expandedInfoIds.delete(id);
        else state.expandedInfoIds.add(id);
        renderTokenList();
      });
    });

    // Diff button
    tokenList.querySelectorAll('.token-diff-btn[data-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const entry = state.capturedTokens.find(t => t.id === btn.dataset.id);
        if (entry) addToDiffSlot(entry.token, entry.id);
      });
    });
  }

  // Patch timestamp display without full re-render
  setInterval(() => {
    if (state.activeTab !== 'captured') return;
    tokenList.querySelectorAll('.token-row-time[data-ts]').forEach(el => {
      el.textContent = relativeTime(Number(el.dataset.ts));
    });
  }, 10_000);

  collapseAllBtn.addEventListener('click', () => {
    const items = buildRenderItems(state.capturedTokens);
    const allGroupIds = items.filter(i => i.type === 'group').map(i => i.groupId);
    const allCollapsed = allGroupIds.every(id => state.collapsedGroupIds.has(id));
    if (allCollapsed) {
      allGroupIds.forEach(id => state.collapsedGroupIds.delete(id));
      collapseAllBtn.textContent = 'Collapse all';
    } else {
      allGroupIds.forEach(id => state.collapsedGroupIds.add(id));
      collapseAllBtn.textContent = 'Expand all';
    }
    renderTokenList();
  });

  clearCapturedBtn.addEventListener('click', () => {
    state.capturedTokens   = [];
    state.selectedId       = null;
    state.expandedInfoIds  = new Set();
    state.expandedGroupIds = new Set();
    state.collapsedGroupIds = new Set();
    state.diffSlotAId = null;
    state.diffSlotBId = null;
    state.newCount    = 0;
    capturedBadge.textContent = '0';
    capturedBadge.classList.remove('visible');
    collapseAllBtn.textContent = 'Collapse all';
    hiddenInput.value = '';
    closeCompareSlot();
    renderTokenList();
    renderOutput();
    if (window.clearBuffer) window.clearBuffer();
  });

  return { renderTokenList };
}
