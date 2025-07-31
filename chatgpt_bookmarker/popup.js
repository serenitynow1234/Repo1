// popup.js - handles displaying bookmarks and summarizing chat

// Load bookmarks from storage and display them
function loadBookmarks() {
  chrome.storage.local.get({ bookmarks: [] }, data => {
    const list = document.getElementById('bookmarkList');
    list.innerHTML = '';
    data.bookmarks.forEach((b, idx) => {
      const li = document.createElement('li');
      li.textContent = b.text.slice(0, 80);
      list.appendChild(li);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadBookmarks();
  document.getElementById('summarizeBtn').addEventListener('click', summarize);
});

// Request messages from the active tab and generate a naive summary
function summarize() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    chrome.tabs.sendMessage(tab.id, { action: 'get_messages' }, response => {
      if (!response) return;
      const msgs = response.messages;
      const allText = msgs.join(' ');
      const words = allText.split(/\s+/);
      const summary = words.slice(0, 50).join(' ') + (words.length > 50 ? '...' : '');
      const actions = msgs.filter(t => /\b(todo|action|remember)\b/i.test(t));
      const div = document.getElementById('summary');
      div.innerHTML = '<h2>Summary</h2><p>' + summary + '</p>';
      if (actions.length) {
        const ul = document.createElement('ul');
        actions.forEach(a => {
          const li = document.createElement('li');
          li.textContent = a.slice(0, 80);
          ul.appendChild(li);
        });
        div.appendChild(document.createElement('h3')).textContent = 'Action Items';
        div.appendChild(ul);
      }
    });
  });
}
