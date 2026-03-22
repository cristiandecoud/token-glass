// Service worker — runs in the background
chrome.runtime.onInstalled.addListener(() => {
  console.log('Token Glass installed');
});
