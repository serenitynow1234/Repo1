function renderList(prompts) {
  const list = document.getElementById('list');
  list.innerHTML = '';
  prompts.forEach((p, index) => {
    const div = document.createElement('div');
    div.className = 'prompt-item';
    div.innerHTML = `<div class="prompt-title">${p.title}</div>` +
                    `<div class="prompt-desc">${p.description}</div>`;
    list.appendChild(div);
  });
}

function loadPrompts() {
  chrome.storage.local.get({prompts: []}, (data) => {
    renderList(data.prompts);
  });
}

document.getElementById('save').addEventListener('click', () => {
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const prompt = document.getElementById('prompt').value.trim();
  if (!title || !prompt) return;
  chrome.storage.local.get({prompts: []}, (data) => {
    data.prompts.push({title, description, prompt});
    chrome.storage.local.set({prompts: data.prompts}, loadPrompts);
  });
});

loadPrompts();
