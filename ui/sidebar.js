export async function createSidebar(hostElement) {
  const shadowRoot = hostElement.attachShadow({ mode: 'open' });
  const [html, css] = await Promise.all([
    fetch(chrome.runtime.getURL('ui/sidebar.html')).then((res) => res.text()),
    fetch(chrome.runtime.getURL('ui/sidebar.css')).then((res) => res.text()),
  ]);
  shadowRoot.innerHTML = html;
  applyStyles(shadowRoot, css);
  const ui = new SidebarUI(shadowRoot);
  return ui;
}

function applyStyles(shadowRoot, cssText) {
  if (shadowRoot.adoptedStyleSheets !== undefined) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
  } else {
    const style = document.createElement('style');
    style.textContent = cssText;
    shadowRoot.prepend(style);
  }
}

class SidebarUI extends EventTarget {
  constructor(shadowRoot) {
    super();
    this.shadowRoot = shadowRoot;
    this.host = shadowRoot.host;
    this.panel = shadowRoot.querySelector('.rv-panel');
    this.toggleTab = shadowRoot.querySelector('.rv-toggle-tab');
    this.collapseButton = shadowRoot.querySelector('.rv-collapse');
    this.messageSelect = shadowRoot.querySelector('.rv-message-select');
    this.filterChips = Array.from(shadowRoot.querySelectorAll('.rv-chip'));
    this.depthSlider = shadowRoot.querySelector('.rv-depth-slider');
    this.depthValue = shadowRoot.querySelector('.rv-depth-value');
    this.simplifyToggle = shadowRoot.querySelector('.rv-simplify-toggle');
    this.contradictionButton = shadowRoot.querySelector('.rv-contradictions');
    this.exportButtons = Array.from(shadowRoot.querySelectorAll('.rv-exports button'));
    this.statusField = shadowRoot.querySelector('.rv-status');
    this.graphContainer = shadowRoot.querySelector('.rv-mermaid');
    this.errorContainer = shadowRoot.querySelector('.rv-error');
    this.contradictionList = shadowRoot.querySelector('.rv-contradiction-list');
    this.toast = shadowRoot.querySelector('.rv-toast');
    this.resizer = shadowRoot.querySelector('.rv-resizer');
    this.currentGraph = null;
    this.currentMermaid = '';
    this.width = 420;
    this.open = true;
    this.filters = { premise: true, logic: true, conclusion: true };

    this.toggleTab.addEventListener('click', () => {
      this.emit('toggle');
    });
    this.toggleTab.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.emit('toggle');
      }
    });
    this.collapseButton.addEventListener('click', () => {
      this.emit('collapse');
    });
    this.messageSelect.addEventListener('change', () => {
      this.emit('message-change', { messageId: this.messageSelect.value });
    });
    this.filterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        const value = chip.classList.contains('active');
        this.filters[chip.dataset.filter] = value;
        this.emit('filter-change', { filter: chip.dataset.filter, value });
      });
    });
    this.depthSlider.addEventListener('input', () => {
      this.depthValue.textContent = this.depthSlider.value;
      this.emit('depth-change', { value: Number(this.depthSlider.value) });
    });
    this.simplifyToggle.addEventListener('change', () => {
      this.emit('simplify-change', { enabled: this.simplifyToggle.checked });
    });
    this.contradictionButton.addEventListener('click', () => {
      this.contradictionButton.classList.toggle('active');
      const enabled = this.contradictionButton.classList.contains('active');
      this.emit('contradiction-toggle', { enabled });
    });
    this.exportButtons.forEach((button) => {
      button.addEventListener('click', () => {
        this.emit('export', { kind: button.dataset.kind });
      });
    });

    this.resizer.addEventListener('pointerdown', (event) => this.beginResize(event));

    this.observeTheme();
  }

  beginResize(event) {
    event.preventDefault();
    this.resizer.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = this.width;
    const onMove = (moveEvent) => {
      const delta = startX - moveEvent.clientX;
      const width = Math.max(280, Math.min(startWidth + delta, 640));
      this.setWidth(width);
      this.emit('resize', { width });
    };
    const onUp = (upEvent) => {
      this.resizer.releasePointerCapture(upEvent.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  observeTheme() {
    const update = () => {
      const themeAttr = document.documentElement.getAttribute('data-theme') || document.documentElement.dataset.theme || '';
      const dark = /dark/i.test(themeAttr);
      this.host.classList.toggle('rv-dark', dark);
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    update();
  }

  emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  on(name, handler) {
    this.addEventListener(name, handler);
  }

  setOpen(open) {
    this.open = open;
    this.host.classList.toggle('rv-open', open);
  }

  setWidth(width) {
    this.width = width;
    this.host.style.setProperty('--rv-width', `${width}px`);
  }

  setMessages(messages) {
    const previous = this.messageSelect.value;
    const options = messages.map((message) => {
      const option = document.createElement('option');
      option.value = message.id;
      option.textContent = truncate(message.label || message.id, 80);
      return option;
    });
    this.messageSelect.replaceChildren(...options);
    if (previous) {
      this.messageSelect.value = previous;
    }
  }

  setActiveMessage(messageId) {
    this.messageSelect.value = messageId;
  }

  setFilters(filters) {
    this.filters = { ...filters };
    this.filterChips.forEach((chip) => {
      const active = !!filters[chip.dataset.filter];
      chip.classList.toggle('active', active);
    });
  }

  setDepth(value) {
    this.depthSlider.value = value;
    this.depthValue.textContent = String(value);
  }

  setSimplify(value) {
    this.simplifyToggle.checked = !!value;
  }

  setContradictionActive(value) {
    this.contradictionButton.classList.toggle('active', !!value);
  }

  renderGraph(svgMarkup, meta = {}) {
    this.errorContainer.hidden = true;
    this.errorContainer.textContent = '';
    this.graphContainer.innerHTML = svgMarkup || '';
    this.currentGraph = meta.graph || null;
    this.currentMermaid = meta.mermaidText || '';
    this.setContradictions(meta.graph?.contradictions || []);
    const svg = this.getGraphSvg();
    if (svg) {
      svg.classList.add('rv-graph');
      svg.dispatchEvent(new CustomEvent('rv-svg-ready', { bubbles: true, composed: true }));
    }
    const event = new CustomEvent('rv-graph-updated', { bubbles: true, composed: true });
    this.shadowRoot.dispatchEvent(event);
  }

  renderError(message) {
    this.errorContainer.hidden = false;
    this.errorContainer.textContent = message;
    this.graphContainer.innerHTML = '';
  }

  getMermaidContainer() {
    return this.graphContainer;
  }

  getGraphSvg() {
    return this.graphContainer.querySelector('svg');
  }

  getCurrentGraph() {
    return this.currentGraph;
  }

  getCurrentMermaid() {
    return this.currentMermaid;
  }

  setStatus(text) {
    this.statusField.textContent = text || '';
  }

  setContradictions(nodes) {
    if (!this.contradictionList) return;
    if (!nodes || !nodes.length) {
      this.contradictionList.hidden = true;
      this.contradictionList.innerHTML = '';
      return;
    }
    const list = document.createElement('ol');
    list.className = 'rv-contradiction-items';
    nodes.forEach((node) => {
      const item = document.createElement('li');
      item.textContent = `${node.id}: ${node.text}`;
      list.appendChild(item);
    });
    this.contradictionList.replaceChildren(list);
    this.contradictionList.hidden = false;
  }

  showToast(message) {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.hidden = false;
    this.toast.style.opacity = '1';
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.style.opacity = '0';
      setTimeout(() => {
        this.toast.hidden = true;
      }, 200);
    }, 1800);
  }

  refreshHeight() {
    const container = this.shadowRoot.querySelector('.rv-graph-container');
    if (!container) return;
    container.style.maxHeight = `${this.host.clientHeight - 240}px`;
  }

  clear() {
    this.messageSelect.replaceChildren();
    this.graphContainer.innerHTML = '';
    this.currentGraph = null;
    this.currentMermaid = '';
    this.setContradictions([]);
    this.setStatus('');
  }
}

function truncate(text, length) {
  if (!text) return '';
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1)}…`;
}
