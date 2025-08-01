function getTextarea() {
  return document.querySelector('textarea');
}

function ensureButton() {
  const textarea = getTextarea();
  if (!textarea) return;
  const container = textarea.parentElement;
  if (container.querySelector('#bookmark-chat')) return;
  addBookmarkButton(container);
}

function collectConversation() {
  const msgs = Array.from(document.querySelectorAll('[data-message-author-role]'));
  return msgs
    .map(m => `${m.dataset.messageAuthorRole}: ${m.innerText}`)
    .join('\n\n');
}

function addBookmarkButton(container) {
  const btn = document.createElement('button');
  btn.id = 'bookmark-chat';
  btn.textContent = 'Bookmark Chat';
  container.appendChild(btn);

  btn.addEventListener('click', () => {
    const title = prompt('Bookmark title:', 'Chat at ' + new Date().toLocaleString());
    if (!title) return;
    const convo = collectConversation();
    chrome.storage.local.get({bookmarks: []}, data => {
      data.bookmarks.push({title, convo, time: Date.now()});
      chrome.storage.local.set({bookmarks: data.bookmarks});
    });
  });
}

// monitor DOM changes in case the chat input box is replaced
const observer = new MutationObserver(ensureButton);
observer.observe(document.body, {childList: true, subtree: true});

// initial attempt
ensureButton();
