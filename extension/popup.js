let editIndex = null;

function loadPrompts() {
  chrome.storage.local.get({prompts: []}, data => {
    const list = document.getElementById('prompt-list');
    list.innerHTML = '';
    data.prompts.forEach((p, index) => {
      const div = document.createElement('div');
      div.className = 'prompt-entry';

      const info = document.createElement('span');
      info.textContent = `${p.title} - ${p.description}`;
      div.appendChild(info);

      const actions = document.createElement('span');
      actions.className = 'prompt-actions';

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        document.getElementById('title').value = p.title;
        document.getElementById('description').value = p.description;
        document.getElementById('text').value = p.text;
        editIndex = index;
        document.querySelector('#prompt-form button').textContent = 'Update';
      });
      actions.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        data.prompts.splice(index, 1);
        chrome.storage.local.set({prompts: data.prompts}, loadPrompts);
      });
      actions.appendChild(delBtn);

      div.appendChild(actions);
      list.appendChild(div);
    });
  });
}

document.getElementById('prompt-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const text = document.getElementById('text').value.trim();
  if (!title || !text) return;

  chrome.storage.local.get({prompts: []}, data => {
    if (editIndex !== null) {
      data.prompts[editIndex] = {title, description, text};
    } else {
      data.prompts.push({title, description, text});
    }
    chrome.storage.local.set({prompts: data.prompts}, () => {
      document.getElementById('title').value = '';
      document.getElementById('description').value = '';
      document.getElementById('text').value = '';
      editIndex = null;
      document.querySelector('#prompt-form button').textContent = 'Save';
      loadPrompts();
    });
  });
});

document.addEventListener('DOMContentLoaded', loadPrompts);
