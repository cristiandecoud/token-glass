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
    : `<span class="json-key">${formatJsonString(key)}</span><span class="json-punct">: </span>`;

  if (value === null || typeof value !== 'object') {
    return `<div class="json-line" style="--depth:${depth}">${keyHtml}${renderJsonPrimitive(value)}${comma}</div>`;
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
