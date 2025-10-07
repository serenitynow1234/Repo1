chrome.runtime.onInstalled.addListener(() => {
  console.log('Reasoning Visualizer background ready');
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-sidebar') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined) return;
    chrome.tabs.sendMessage(tab.id, { type: 'RV_TOGGLE_SIDEBAR' });
  } catch (error) {
    console.error('Reasoning Visualizer toggle failed', error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'RV_REQUEST_TOGGLE' && sender.tab?.id) {
    chrome.tabs.sendMessage(sender.tab.id, { type: 'RV_TOGGLE_SIDEBAR' });
    sendResponse({ ok: true });
  }
});
