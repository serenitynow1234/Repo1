function waitForChatContainer() {
  return new Promise(resolve => {
    const i = setInterval(() => {
      const container = document.querySelector('textarea')?.parentElement;
      if (container) {
        clearInterval(i);
        resolve(container);
      }
    }, 500);
  });
}

function collectConversation() {
  const msgs = Array.from(document.querySelectorAll('[data-message-author-role]'));
  return msgs.map(m => m.innerText).join('\n\n');
}

function addBookmarkButton(container) {
  const btn = document.createElement('button');
  btn.id = 'bookmark-chat';
  btn.textContent = 'Bookmark Chat';
  btn.style.marginLeft = '8px';
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

waitForChatContainer().then(addBookmarkButton);
