// Background script for the ChatGPT Prompt Manager
// Currently used to initialize default storage on install.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({prompts: []}, data => {
    if (!Array.isArray(data.prompts)) {
      chrome.storage.local.set({prompts: []});
    }
  });
});
