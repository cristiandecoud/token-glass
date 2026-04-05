const DEBOUNCE_MS = 120;

export function createSearch({ output, input, count, prevBtn, nextBtn, closeBtn }) {
  let query = '';
  let matches = [];
  let activeIndex = -1;
  let autoOpened = new Set();
  let debounceId = null;

  function updateControls() {
    const hasQuery = query.trim().length > 0;
    const hasMatches = matches.length > 0;
    count.textContent = hasQuery ? `${hasMatches ? activeIndex + 1 : 0}/${matches.length}` : '0/0';
    prevBtn.disabled = !hasMatches;
    nextBtn.disabled = !hasMatches;
  }

  function restoreAutoOpened() {
    autoOpened.forEach(d => { if (d.isConnected) d.open = false; });
    autoOpened = new Set();
  }

  function clearHighlights() {
    output.querySelectorAll('.search-hit').forEach(mark => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
    restoreAutoOpened();
    matches = [];
    activeIndex = -1;
    updateControls();
  }

  function openAncestorDetails(node) {
    let el = node.parentElement;
    while (el) {
      if (el.tagName === 'DETAILS' && !el.open) { el.open = true; autoOpened.add(el); }
      el = el.parentElement;
    }
  }

  function isVisible(node) {
    let el = node.parentElement;
    while (el && el !== output) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      el = el.parentElement;
    }
    const parent = node.parentElement;
    return Boolean(parent && parent.getClientRects().length > 0);
  }

  function collectTextNodes() {
    const walker = document.createTreeWalker(output, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('.copy-btn, .search-bar, .search-count, script, style, textarea')) return NodeFilter.FILTER_REJECT;
        if (!isVisible(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function focusMatch(index) {
    if (!matches.length) { activeIndex = -1; updateControls(); return; }
    if (index < 0) index = matches.length - 1;
    if (index >= matches.length) index = 0;
    matches.forEach(m => m.classList.remove('active'));
    activeIndex = index;
    matches[index].classList.add('active');
    matches[index].scrollIntoView({ block: 'center', behavior: 'smooth' });
    updateControls();
  }

  function apply(newQuery) {
    query = newQuery;
    clearHighlights();
    const normalized = newQuery.trim();
    if (!normalized) return;

    const re = new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    collectTextNodes().forEach(node => {
      const text = node.nodeValue;
      re.lastIndex = 0;
      let m = re.exec(text);
      if (!m) return;

      const frag = document.createDocumentFragment();
      let last = 0;
      while (m) {
        const start = m.index, end = start + m[0].length;
        if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)));
        const mark = document.createElement('mark');
        mark.className = 'search-hit';
        mark.textContent = text.slice(start, end);
        frag.appendChild(mark);
        matches.push(mark);
        last = end;
        m = re.exec(text);
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });

    matches.forEach(openAncestorDetails);
    if (matches.length > 0) focusMatch(0);
    else updateControls();
  }

  function sync() {
    if (query.trim()) apply(query);
    else clearHighlights();
  }

  function open() {
    input.focus();
    input.select();
    updateControls();
  }

  function close() {
    input.value = '';
    query = '';
    clearHighlights();
    input.focus();
  }

  // Event bindings
  input.addEventListener('input', () => {
    clearTimeout(debounceId);
    debounceId = setTimeout(() => { debounceId = null; apply(input.value); }, DEBOUNCE_MS);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); focusMatch(activeIndex + (e.shiftKey ? -1 : 1)); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  prevBtn.addEventListener('click', () => focusMatch(activeIndex - 1));
  nextBtn.addEventListener('click', () => focusMatch(activeIndex + 1));
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); open(); }
  });

  return { apply, sync, open, close };
}
