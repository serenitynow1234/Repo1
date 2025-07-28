function waitForInputBox() {
  return new Promise(resolve => {
    const i = setInterval(() => {
      const box = document.querySelector('textarea');
      if (box) {
        clearInterval(i);
        resolve(box);
      }
    }, 500);
  });
}

function createSearchUI(textarea) {
  const container = document.createElement('div');
  container.id = 'prompt-search-container';
  const input = document.createElement('input');
  input.id = 'prompt-search';
  input.placeholder = 'Search saved prompts...';
  const addBtn = document.createElement('button');
  addBtn.id = 'add-prompt';
  addBtn.textContent = 'Add Prompt';
  const results = document.createElement('div');
  results.id = 'prompt-results';
  results.style.display = 'none';
  container.appendChild(input);
  container.appendChild(addBtn);
  container.appendChild(results);
  textarea.parentElement.appendChild(container);

  const dialog = document.createElement('dialog');
  dialog.id = 'prompt-dialog';
  dialog.innerHTML = `
    <form method="dialog" id="prompt-dialog-form">
      <label>Title<br><input type="text" id="prompt-title" required></label>
      <label>Description<br><input type="text" id="prompt-desc"></label>
      <label>Prompt<br><textarea id="prompt-text" rows="4" required></textarea></label>
      <div class="dialog-buttons">
        <button id="save-prompt" type="submit">Save</button>
        <button id="cancel-prompt" type="button">Cancel</button>
      </div>
    </form>`;
  container.appendChild(dialog);

  addBtn.addEventListener('click', () => {
    dialog.querySelector('#prompt-title').value = '';
    dialog.querySelector('#prompt-desc').value = '';
    dialog.querySelector('#prompt-text').value = textarea.value;
    dialog.showModal();
  });

  dialog.querySelector('#cancel-prompt').addEventListener('click', () => {
    dialog.close();
  });

  dialog.querySelector('#prompt-dialog-form').addEventListener('submit', e => {
    e.preventDefault();
    const title = dialog.querySelector('#prompt-title').value.trim();
    const description = dialog.querySelector('#prompt-desc').value.trim();
    const text = dialog.querySelector('#prompt-text').value;
    if (!title || !text) return;
    chrome.storage.local.get({prompts: []}, data => {
      data.prompts.push({title, description, text});
      chrome.storage.local.set({prompts: data.prompts}, () => {
        dialog.close();
        input.dispatchEvent(new Event('input'));
      });
    });
  });

  input.addEventListener('input', () => {
    const query = input.value.toLowerCase();
    if (!query) {
      results.style.display = 'none';
      results.innerHTML = '';
      return;
    }
    chrome.storage.local.get({prompts: []}, data => {
      const prompts = data.prompts.filter(p =>
        p.title.toLowerCase().includes(query)
      );
      results.innerHTML = '';
      prompts.forEach(p => {
        const item = document.createElement('div');
        item.className = 'prompt-item';
        item.innerHTML =
          `<strong>${p.title}</strong><br/><small>${p.description}</small>`;
        item.addEventListener('click', () => {
          textarea.value = p.text;
          results.style.display = 'none';
        });
        results.appendChild(item);
      });
      results.style.display = prompts.length ? 'block' : 'none';
    });
  });
}

waitForInputBox().then(createSearchUI);
