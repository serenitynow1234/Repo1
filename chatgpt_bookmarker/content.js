// content.js - injected into ChatGPT pages
// Adds bookmark icons to each message and handles storing bookmarks

// CSS class for bookmark icon
const BOOKMARK_CLASS = 'cgpt-bookmark-icon';

// Observe DOM changes to catch new messages
const observer = new MutationObserver(() => {
  addIcons();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial call
addIcons();

// Add bookmark icons next to thumbs icons
function addIcons() {
  // Messages have attribute data-message-author-role
  const messages = document.querySelectorAll('div[data-message-author-role]');
  messages.forEach(msg => {
    // Avoid adding twice
    if (msg.querySelector('.' + BOOKMARK_CLASS)) return;

    const actionsContainer = msg.querySelector('div.flex.items-center');
    // Fallback to message element if action bar not found
    const container = actionsContainer || msg;

    const icon = document.createElement('span');
    icon.textContent = '🔖';
    icon.title = 'Bookmark this message';
    icon.className = BOOKMARK_CLASS;
    icon.style.cursor = 'pointer';
    icon.style.marginLeft = '4px';

    icon.addEventListener('click', e => {
      e.stopPropagation();
      bookmarkMessage(msg.innerText.trim());
    });

    container.appendChild(icon);
  });
}

// Store message text in chrome.storage.local
function bookmarkMessage(text) {
  chrome.storage.local.get({ bookmarks: [] }, data => {
    const bookmarks = data.bookmarks;
    bookmarks.push({ text, url: location.href, time: Date.now() });
    chrome.storage.local.set({ bookmarks });
  });
}

// Listen for requests from popup.js to get all messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'get_messages') {
    const messages = Array.from(document.querySelectorAll('div[data-message-author-role]'))
      .map(el => el.innerText.trim());
    sendResponse({ messages });
  }
});
