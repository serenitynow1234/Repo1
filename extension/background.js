// Initialize storage when the extension is installed.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({prompts: []}, data => {
    if (!Array.isArray(data.prompts)) {
      chrome.storage.local.set({prompts: []});
    }
  });
});
