// Content script for ChatGPT Bookmarker
// This script injects bookmark buttons into each ChatGPT message
// and listens for messages from the popup to provide chat contents.

// Utility to add bookmark buttons to all messages
function addBookmarks() {
  // ChatGPT messages are contained in elements with data-testid="conversation-turn".
  // We iterate through each and inject a button if it doesn't already exist.
  const turns = document.querySelectorAll('[data-testid="conversation-turn"]');
  turns.forEach(turn => {
    // Avoid inserting multiple buttons
    if (turn.querySelector('.chatgpt-bookmark-btn')) return;

    // Locate the footer that contains the thumbs buttons
    const footer = turn.querySelector('div.flex.gap-2') ||
                   turn.querySelector('div.flex.justify-between');
    if (!footer) return;

    // Create bookmark button
    const btn = document.createElement('button');
    btn.textContent = '🔖'; // simple bookmark icon
    btn.title = 'Bookmark this message';
    btn.className = 'chatgpt-bookmark-btn';

    // Save the text when clicked
    btn.addEventListener('click', () => {
      const textEl = turn.querySelector('.markdown');
      const text = textEl ? textEl.innerText : turn.innerText;
      chrome.storage.local.get({bookmarks: []}, data => {
        data.bookmarks.push({text, time: Date.now()});
        chrome.storage.local.set({bookmarks: data.bookmarks});
      });
    });

    footer.appendChild(btn);
  });
}

// Observe DOM changes to catch new messages
const observer = new MutationObserver(addBookmarks);
observer.observe(document.body, {childList: true, subtree: true});

// Initial run after page load
addBookmarks();

// Listen for requests from popup to gather all messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'get_messages') {
    const msgs = Array.from(document.querySelectorAll('[data-testid="conversation-turn"] .markdown'))
      .map(el => el.innerText.trim());
    sendResponse({messages: msgs});
    return true; // keep the channel open
  }
});
