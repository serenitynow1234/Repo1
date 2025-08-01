// Popup script for ChatGPT Bookmarker
// Displays saved bookmarks and provides a summarize button.

document.addEventListener('DOMContentLoaded', () => {
  renderBookmarks();
  document.getElementById('summarize').addEventListener('click', summarizeChat);
});

// Load bookmarks from storage and show them in the popup
function renderBookmarks() {
  chrome.storage.local.get({bookmarks: []}, data => {
    const container = document.getElementById('bookmarks');
    container.innerHTML = '';
    data.bookmarks.forEach(bm => {
      const div = document.createElement('div');
      div.className = 'bookmark-item';
      div.textContent = bm.text;
      container.appendChild(div);
    });
  });
}

// Ask the content script for visible messages and produce a summary
function summarizeChat() {
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    if (!tabs.length) return;
    chrome.tabs.sendMessage(tabs[0].id, {action: 'get_messages'}, res => {
      if (!res) return;
      const summary = createSummary(res.messages);
      const actions = extractActions(res.messages);
      document.getElementById('summary').textContent = summary;
      const list = document.getElementById('actions');
      list.innerHTML = '';
      actions.forEach(a => {
        const li = document.createElement('li');
        li.textContent = a;
        list.appendChild(li);
      });
    });
  });
}

// Very naive summarization: return the first 100 words of the chat
function createSummary(msgs) {
  const words = msgs.join(' ').split(/\s+/);
  return words.slice(0, 100).join(' ') + (words.length > 100 ? '...' : '');
}

// Extract lines that look like action items
function extractActions(msgs) {
  const actions = [];
  msgs.forEach(m => {
    m.split('\n').forEach(line => {
      if (/^(\-|\*|\d+\.)\s+/.test(line) || line.toLowerCase().includes('todo') || line.toLowerCase().startsWith('action')) {
        actions.push(line.trim());
      }
    });
  });
  return actions;
}
