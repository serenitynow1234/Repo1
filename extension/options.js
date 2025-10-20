function loadPrompts() {
  chrome.storage.local.get({prompts: []}, data => {
    const list = document.getElementById('prompt-list');
    list.innerHTML = '';
    data.prompts.forEach((p, index) => {
      const div = document.createElement('div');
      div.className = 'prompt-entry';
      div.textContent = `${p.title} - ${p.description}`;
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.className = 'delete';
      del.addEventListener('click', () => {
        data.prompts.splice(index, 1);
        chrome.storage.local.set({prompts: data.prompts}, loadPrompts);
      });
      div.appendChild(del);
      list.appendChild(div);
    });
  });
}

document.getElementById('prompt-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const text = document.getElementById('text').value;
  if (!title || !text) return;
  chrome.storage.local.get({prompts: []}, data => {
    data.prompts.push({title, description, text});
    chrome.storage.local.set({prompts: data.prompts}, () => {
      document.getElementById('title').value = '';
      document.getElementById('description').value = '';
      document.getElementById('text').value = '';
      loadPrompts();
    });
  });
});

document.addEventListener('DOMContentLoaded', loadPrompts);
