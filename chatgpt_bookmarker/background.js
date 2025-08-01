// Ensure bookmarks array exists on install.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({bookmarks: []}, data => {
    if (!Array.isArray(data.bookmarks)) {
      chrome.storage.local.set({bookmarks: []});
    }
  });
});
