import { escapeHtml, renderJsonNode } from './json-tree.js';
import { base64UrlDecode } from './jwt.js';

export function diffObjects(objA, objB) {
  const keys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
  return [...keys].map(key => {
    const inA = Object.prototype.hasOwnProperty.call(objA, key);
    const inB = Object.prototype.hasOwnProperty.call(objB, key);
    if (inA && inB) {
      const same = JSON.stringify(objA[key]) === JSON.stringify(objB[key]);
      return { key, valueA: objA[key], valueB: objB[key], status: same ? 'same' : 'changed' };
    }
    if (inA) return { key, valueA: objA[key], valueB: undefined, status: 'only-a' };
    return { key, valueA: undefined, valueB: objB[key], status: 'only-b' };
  });
}

export function buildAlignedDiff(objA, objB) {
  const rows = diffObjects(objA, objB).map(({ key, valueA, valueB, status }) => {
    const cellA = valueA !== undefined ? renderJsonNode(valueA, 0, false, key) : '';
    const cellB = valueB !== undefined ? renderJsonNode(valueB, 0, false, key) : '';
    return `<div class="diff-aligned-row diff-key-${status}">
      <div class="diff-aligned-cell diff-aligned-a json-output${valueA === undefined ? ' diff-aligned-empty' : ''}">${cellA}</div>
      <div class="diff-aligned-cell diff-aligned-b json-output${valueB === undefined ? ' diff-aligned-empty' : ''}">${cellB}</div>
    </div>`;
  }).join('');
  return `<div class="diff-aligned-grid">${rows}</div>`;
}

export function renderDiff(output, tokenA, tokenB) {
  if (!tokenA && !tokenB) {
    output.innerHTML = '<div class="diff-empty">Paste two JWTs to compare them</div>';
    return;
  }
  if (!tokenA || !tokenB) {
    output.innerHTML = '<div class="diff-empty">Paste both tokens to compare</div>';
    return;
  }

  let headerA, payloadA, headerB, payloadB;
  try {
    headerA = base64UrlDecode(tokenA.split('.')[0]);
    payloadA = base64UrlDecode(tokenA.split('.')[1]);
  } catch {
    output.innerHTML = '<div class="error-state">Token A: invalid JWT</div>';
    return;
  }
  try {
    headerB = base64UrlDecode(tokenB.split('.')[0]);
    payloadB = base64UrlDecode(tokenB.split('.')[1]);
  } catch {
    output.innerHTML = '<div class="error-state">Token B: invalid JWT</div>';
    return;
  }

  const allDiffs = diffObjects(headerA, headerB).concat(diffObjects(payloadA, payloadB));
  const changedCount = allDiffs.filter(r => r.status !== 'same').length;

  const section = (labelClass, label, a, b) => `
    <div class="diff-json-section">
      <div class="diff-section-header ${labelClass}"><span class="dot"></span>${label}</div>
      ${buildAlignedDiff(a, b)}
    </div>`;

  const sigStatus = tokenA.split('.')[2] === tokenB.split('.')[2] ? 'same' : 'changed';

  output.innerHTML = `
    <div class="diff-summary">${changedCount === 0
      ? 'Tokens are identical'
      : `${changedCount} difference${changedCount !== 1 ? 's' : ''}`
    }</div>
    <div class="diff-json-col-headers">
      <div><span class="diff-slot-badge diff-badge-a">A</span></div>
      <div><span class="diff-slot-badge diff-badge-b">B</span></div>
    </div>
    ${section('header-label', 'Header', headerA, headerB)}
    ${section('payload-label', 'Payload', payloadA, payloadB)}
    <div class="diff-json-section">
      <div class="diff-section-header sig-label"><span class="dot"></span>Signature</div>
      <div class="diff-aligned-grid">
        <div class="diff-aligned-row diff-key-${sigStatus}">
          <div class="diff-aligned-cell diff-aligned-a diff-sig-col">${escapeHtml(tokenA.split('.')[2])}</div>
          <div class="diff-aligned-cell diff-aligned-b diff-sig-col">${escapeHtml(tokenB.split('.')[2])}</div>
        </div>
      </div>
    </div>
  `;
}
