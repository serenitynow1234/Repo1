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
  const results = document.createElement('div');
  results.id = 'prompt-results';
  results.style.display = 'none';
  container.appendChild(input);
  container.appendChild(results);
  textarea.parentElement.appendChild(container);

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
