const JWT_RE = /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/;

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'decode-jwt',
      title: 'Decode in Token Glass',
      contexts: ['selection'],
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'decode-jwt') return;
  const text = (info.selectionText || '').replace(/\s+/g, '');
  const match = text.match(JWT_RE);
  if (!match) return;
  chrome.storage.session.set({ pendingToken: { token: match[0], timestamp: Date.now() } });
});
