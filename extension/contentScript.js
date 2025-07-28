function createSearchBar() {
  const inputBox = document.querySelector('form textarea');
  if (!inputBox || document.getElementById('prompt-search')) return;

  const container = document.createElement('div');
  container.style.marginTop = '10px';

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Search saved prompts...';
  search.id = 'prompt-search';
  search.style.width = '100%';
  search.style.boxSizing = 'border-box';

  const results = document.createElement('div');
  results.id = 'prompt-results';
  results.style.background = '#fff';
  results.style.border = '1px solid #ccc';
  results.style.maxHeight = '150px';
  results.style.overflowY = 'auto';
  results.style.display = 'none';
  results.style.position = 'absolute';
  results.style.zIndex = '1000';

  container.appendChild(search);
  container.appendChild(results);
  inputBox.parentElement.appendChild(container);

  search.addEventListener('input', () => {
    const term = search.value.trim().toLowerCase();
    if (!term) {
      results.style.display = 'none';
      return;
    }
    chrome.storage.local.get({prompts: []}, data => {
      const matches = data.prompts.filter(p => p.title.toLowerCase().includes(term));
      results.innerHTML = '';
      matches.forEach(p => {
        const item = document.createElement('div');
        item.textContent = p.title;
        item.style.padding = '5px';
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
          inputBox.value = p.prompt;
          results.style.display = 'none';
          search.value = '';
          inputBox.focus();
        });
        results.appendChild(item);
      });
      results.style.display = matches.length ? 'block' : 'none';
    });
  });
}

const observer = new MutationObserver(() => createSearchBar());
observer.observe(document.body, {childList: true, subtree: true});
