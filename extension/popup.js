let editIndex = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add').addEventListener('click', () => openDialog());
  document.getElementById('prompt-form').addEventListener('submit', savePrompt);
  document.getElementById('cancel').addEventListener('click', closeDialog);
  loadPrompts();
});

function loadPrompts() {
  chrome.storage.local.get({prompts: []}, data => {
    const list = document.getElementById('prompt-list');
    list.innerHTML = '';
    data.prompts.forEach((p, index) => {
      const div = document.createElement('div');
      div.className = 'entry';
      div.innerHTML = `<div class="entry-title">${p.title}</div>` +
        `<div class="entry-desc">${p.description}</div>`;
      const actions = document.createElement('div');
      actions.className = 'entry-actions';
      const edit = document.createElement('button');
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => openDialog(p, index));
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        data.prompts.splice(index, 1);
        chrome.storage.local.set({prompts: data.prompts}, loadPrompts);
      });
      actions.appendChild(edit);
      actions.appendChild(del);
      div.appendChild(actions);
      list.appendChild(div);
    });
  });
}

function openDialog(prompt = {}, index = null) {
  editIndex = index;
  document.getElementById('title').value = prompt.title || '';
  document.getElementById('description').value = prompt.description || '';
  document.getElementById('text').value = prompt.text || '';
  document.getElementById('dialog').showModal();
}

function closeDialog() {
  document.getElementById('dialog').close();
}

function savePrompt(e) {
  e.preventDefault();
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const text = document.getElementById('text').value;
  if (!title || !text) return;

  chrome.storage.local.get({prompts: []}, data => {
    if (editIndex === null) {
      data.prompts.push({title, description, text});
    } else {
      data.prompts[editIndex] = {title, description, text};
    }
    chrome.storage.local.set({prompts: data.prompts}, () => {
      editIndex = null;
      closeDialog();
      loadPrompts();
    });
  });
}
