function render() {
  chrome.storage.local.get({bookmarks: []}, data => {
    const list = document.getElementById('list');
    list.innerHTML = '';
    const tmpl = document.getElementById('item-template');
    data.bookmarks.forEach((b, idx) => {
      const item = tmpl.content.firstElementChild.cloneNode(true);
      item.querySelector('.title').textContent = b.title;
      item.querySelector('.convo').value = b.convo;
      item.querySelector('.copy').addEventListener('click', () => {
        navigator.clipboard.writeText(b.convo);
      });
      item.querySelector('.delete').addEventListener('click', () => {
        data.bookmarks.splice(idx, 1);
        chrome.storage.local.set({bookmarks: data.bookmarks}, render);
      });
      list.appendChild(item);
    });
  });
}

document.addEventListener('DOMContentLoaded', render);
