import { TIMESTAMP_CLAIMS, SCOPE_CLAIMS, CLAIM_DESCRIPTIONS } from './claims.js';

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function formatJsonString(value) {
  return escapeHtml(JSON.stringify(value));
}

function renderJsonPrimitive(value) {
  if (typeof value === 'string') return `<span class="json-string">${formatJsonString(value)}</span>`;
  if (typeof value === 'number') return `<span class="json-number">${value}</span>`;
  if (typeof value === 'boolean') return `<span class="json-bool">${value}</span>`;
  return `<span class="json-null">null</span>`;
}

// ── Claim breakdowns & info ──────────────────────────────────────

function relativeTime(ms) {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < 60000) return past ? 'just now' : 'moments away';
  if (abs < 3600000) { const m = Math.round(abs / 60000); return past ? `${m}m ago` : `in ${m}m`; }
  if (abs < 86400000) { const h = Math.round(abs / 3600000); return past ? `${h}h ago` : `in ${h}h`; }
  const d = Math.round(abs / 86400000);
  return past ? `${d}d ago` : `in ${d}d`;
}

function renderClaimAnnotation(key, value) {
  if (TIMESTAMP_CLAIMS.has(key) && typeof value === 'number') {
    const ms = value * 1000;
    const date = new Date(ms);
    const rel = relativeTime(ms);
    const isExp = key === 'exp';
    const expired = isExp && ms < Date.now();
    const statusHtml = isExp
      ? `<span class="claim-status ${expired ? 'claim-expired' : 'claim-valid'}">${expired ? 'expired' : 'valid'}</span>`
      : '';
    return `<span class="claim-inline">` +
      `<span class="claim-bd-date">${escapeHtml(date.toLocaleString())}</span>` +
      `<span class="claim-bd-sep">·</span>` +
      `<span class="claim-bd-rel">${escapeHtml(rel)}</span>` +
      statusHtml +
      `</span>`;
  }

  if (SCOPE_CLAIMS.has(key) && typeof value === 'string') {
    const scopes = value.trim().split(/\s+/).filter(Boolean);
    if (scopes.length > 1) {
      const tags = scopes.map(s => `<span class="scope-tag">${escapeHtml(s)}</span>`).join('');
      return `<span class="claim-inline">${tags}</span>`;
    }
  }

  return '';
}

function claimInfoAttrs(key) {
  const desc = CLAIM_DESCRIPTIONS[key];
  if (!desc) return '';
  return ` class="json-key claim-info" data-tooltip="${escapeHtml(desc)}"`;
}

function renderInlinePreview(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string') {
      const truncated = value.length > 26 ? `${value.slice(0, 26)}…` : value;
      return `<span class="json-string">${formatJsonString(truncated)}</span>`;
    }
    return renderJsonPrimitive(value);
  }
  if (Array.isArray(value)) {
    return '<span class="json-punct">[</span><span class="json-ellipsis">…</span><span class="json-punct">]</span>';
  }
  return '<span class="json-punct">{</span><span class="json-ellipsis">…</span><span class="json-punct">}</span>';
}

function renderCollapsedPreview(value) {
  const isArray = Array.isArray(value);
  const entries = isArray ? value : Object.entries(value);
  return entries.slice(0, 3).map((entry, index) => {
    const prefix = index > 0 ? '<span class="json-punct">, </span>' : '';
    if (isArray) return `${prefix}${renderInlinePreview(entry)}`;
    const [key, child] = entry;
    return `${prefix}<span class="json-key">${formatJsonString(key)}</span><span class="json-punct">: </span>${renderInlinePreview(child)}`;
  }).join('') + (entries.length > 3 ? '<span class="json-punct">, </span><span class="json-ellipsis">…</span>' : '');
}

export function renderJsonNode(value, depth = 0, trailingComma = false, key = null) {
  const comma = trailingComma ? '<span class="json-punct">,</span>' : '';
  const keyHtml = key === null
    ? ''
    : `<span${claimInfoAttrs(key) || ` class="json-key"`}>${formatJsonString(key)}</span><span class="json-punct">: </span>`;

  if (value === null || typeof value !== 'object') {
    const annotation = key !== null ? renderClaimAnnotation(key, value) : '';
    return `<div class="json-line" style="--depth:${depth}">${keyHtml}${renderJsonPrimitive(value)}${comma}${annotation}</div>`;
  }

  const isArray = Array.isArray(value);
  const openToken = isArray ? '[' : '{';
  const closeToken = isArray ? ']' : '}';
  const entries = isArray ? value : Object.entries(value);

  if (entries.length === 0) {
    return `<div class="json-line" style="--depth:${depth}">${keyHtml}<span class="json-punct">${openToken}${closeToken}</span>${comma}</div>`;
  }

  const children = entries.map((entry, index) => {
    if (isArray) return renderJsonNode(entry, depth + 1, index < entries.length - 1);
    const [childKey, childValue] = entry;
    return renderJsonNode(childValue, depth + 1, index < entries.length - 1, childKey);
  }).join('');

  const itemLabel = isArray ? `${entries.length} items` : `${entries.length} keys`;

  return `
    <details class="json-node" open>
      <summary class="json-summary json-line" style="--depth:${depth}">
        <span class="json-disclosure" aria-hidden="true"></span>
        <span class="json-open-label">${keyHtml}<span class="json-punct">${openToken}</span><span class="json-meta">${itemLabel}</span></span>
        <span class="json-closed-label">${keyHtml}<span class="json-punct">${openToken}</span><span class="json-preview">${renderCollapsedPreview(value)}</span><span class="json-punct">${closeToken}</span>${comma}</span>
      </summary>
      <div class="json-children">${children}</div>
      <div class="json-line json-closing" style="--depth:${depth}"><span class="json-punct">${closeToken}</span>${comma}</div>
    </details>
  `;
}

export function renderJsonTree(value) {
  return `<div class="json-tree">${renderJsonNode(value)}</div>`;
}
