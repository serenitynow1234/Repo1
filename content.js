(() => {
  if (window.__ReasoningVisualizerLoaded) {
    return;
  }
  window.__ReasoningVisualizerLoaded = true;

  const FILTER_DEFAULT = { premise: true, logic: true, conclusion: true };
  const BASE_STATE = {
    open: true,
    width: 420,
    filters: { ...FILTER_DEFAULT },
    depth: 5,
    simplify: false,
    contradictionsActive: false,
    activeMessage: null,
  };
  let processedMessages = new WeakSet();
  const messageGraphs = new Map();
  const sentenceMap = new Map();
  const messageOrder = [];

  let sidebar;
  let mermaidApi;
  let currentState = { ...BASE_STATE, filters: { ...FILTER_DEFAULT } };

  let currentThreadId = getThreadId();
  let hostElement;

  const highlightStyle = document.createElement('style');
  highlightStyle.textContent = `
    .rv-source-sentence {
      background: none;
      transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
    }
    .rv-source-sentence.rv-highlight {
      background: rgba(255, 230, 170, 0.65);
      box-shadow: 0 0 0 2px rgba(255, 200, 87, 0.4);
      border-radius: 3px;
    }
    .rv-source-sentence.rv-contradiction {
      background: rgba(255, 128, 128, 0.3);
    }
  `;
  document.head.appendChild(highlightStyle);

  domReady(async () => {
    hostElement = document.createElement('div');
    hostElement.id = 'rv-sidebar-host';
    hostElement.style.cssText = [
      'position:fixed',
      'top:0',
      'right:0',
      'height:100%',
      'z-index:2147483646',
      'width:420px',
      'max-width:48vw',
    ].join(';');
    document.body.appendChild(hostElement);

    const { createSidebar } = await import(chrome.runtime.getURL('ui/sidebar.js'));
    sidebar = await createSidebar(hostElement);

    sidebar.on('toggle', () => toggleSidebar());
    sidebar.on('collapse', () => setSidebarOpen(false));
    sidebar.on('filter-change', (event) => {
      const { filter, value } = event.detail;
      currentState.filters[filter] = value;
      applyFilterClasses();
      saveState();
    });
    sidebar.on('depth-change', (event) => {
      currentState.depth = event.detail.value;
      renderActiveGraph();
      saveState();
    });
    sidebar.on('simplify-change', (event) => {
      currentState.simplify = event.detail.enabled;
      renderActiveGraph();
      saveState();
    });
    sidebar.on('message-change', (event) => {
      currentState.activeMessage = event.detail.messageId;
      renderActiveGraph();
      saveState();
    });
    sidebar.on('export', handleExport);
    sidebar.on('resize', (event) => {
      const width = Math.max(280, Math.min(event.detail.width, 600));
      currentState.width = width;
      if (hostElement && currentState.open) {
        hostElement.style.width = `${width}px`;
      }
      sidebar.setWidth(width);
      saveState();
    });
    sidebar.on('contradiction-toggle', (event) => {
      currentState.contradictionsActive = event.detail.enabled;
      syncContradictionHighlights();
      saveState();
    });

    const stored = await loadState();
    if (stored) {
      currentState = { ...currentState, ...stored };
      if (stored.filters) {
        currentState.filters = { ...FILTER_DEFAULT, ...stored.filters };
      }
    }
    hostElement.style.width = currentState.open ? `${currentState.width}px` : '32px';
    sidebar.setWidth(currentState.width);
    sidebar.setOpen(currentState.open);
    sidebar.setDepth(currentState.depth);
    sidebar.setFilters(currentState.filters);
    sidebar.setSimplify(currentState.simplify);
    sidebar.setContradictionActive(currentState.contradictionsActive);

    setupObservers();
    processExistingMessages();
    applyFilterClasses();
    syncContradictionHighlights();

    setInterval(() => {
      const threadId = getThreadId();
      if (threadId !== currentThreadId) {
        currentThreadId = threadId;
        resetForThread();
      }
    }, 1500);

    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === 'RV_TOGGLE_SIDEBAR') {
        toggleSidebar();
      }
    });
  });

  function setupObservers() {
    const container = document.body;
    const observer = new MutationObserver(
      debounce((mutations) => {
        const seen = new Set();
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            const message = findAssistantMessage(node);
            if (message && !seen.has(message)) {
              seen.add(message);
              processMessage(message);
            }
            node.querySelectorAll?.('[data-message-author-role="assistant"]').forEach((child) => {
              if (!seen.has(child)) {
                seen.add(child);
                processMessage(child);
              }
            });
          });
        });
      }, 300)
    );
    observer.observe(container, { childList: true, subtree: true });
  }

  function processExistingMessages() {
    document
      .querySelectorAll('[data-message-author-role="assistant"]')
      .forEach((message) => processMessage(message));
  }

  function processMessage(messageElement) {
    if (!messageElement || processedMessages.has(messageElement)) return;
    processedMessages.add(messageElement);

    const messageId = messageElement.getAttribute('data-message-id') ||
      messageElement.dataset.messageId ||
      `assistant-${messageOrder.length + 1}`;

    const segmentData = extractSegments(messageElement, messageId);
    if (!segmentData.segments.length) {
      return;
    }

    const graph = ReasoningParser.buildGraph(segmentData.segments);
    messageGraphs.set(messageId, { graph, segmentData, element: messageElement });
    if (!messageOrder.includes(messageId)) {
      messageOrder.push(messageId);
    }

    sidebar.setMessages(
      messageOrder.map((id, index) => ({
        id,
        label: messageGraphs.get(id)?.segmentData?.titleMap?.[id] || `Assistant Reply ${index + 1}`,
      }))
    );
    sidebar.setActiveMessage(currentState.activeMessage || messageId);

    if (!currentState.activeMessage) {
      currentState.activeMessage = messageId;
      sidebar.setActiveMessage(messageId);
      saveState();
    }

    if (currentState.activeMessage === messageId) {
      renderActiveGraph();
    }
    syncContradictionHighlights();
  }

  function extractSegments(messageElement, messageId) {
    const segments = [];
    const titleMap = {};
    let order = 0;

    const walker = document.createTreeWalker(
      messageElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.parentElement) return NodeFilter.FILTER_REJECT;
          if (node.parentElement.closest('code, pre, blockquote, table, thead, tbody, tfoot')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.parentElement.closest('.rv-source-sentence')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.textContent || !node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false
    );

    const sectionCache = new Map();

    const ensureSentenceSpan = (textNode, parts) => {
      const fragment = document.createDocumentFragment();
      const contextElement = textNode.parentElement || messageElement;
      const contextListType = getListType(contextElement);
      const contextDepth = getDepth(contextElement);
      const contextSection = getSectionTitle(contextElement);
      parts.forEach((part, index) => {
        const sentenceId = `${messageId}-s${++order}`;
        const span = document.createElement('span');
        span.textContent = part.sentence;
        span.className = 'rv-source-sentence';
        span.dataset.rvSentenceId = sentenceId;
        fragment.appendChild(span);
        sentenceMap.set(sentenceId, { element: span, messageId });
        segments.push({
          text: part.sentence,
          sentenceId,
          order,
          listType: contextListType,
          depthHint: contextDepth,
          section: contextSection,
        });
        if (part.trailing) {
          fragment.appendChild(document.createTextNode(part.trailing));
        } else if (index < parts.length - 1) {
          fragment.appendChild(document.createTextNode(' '));
        }
      });
      textNode.replaceWith(fragment);
    };

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parts = ReasoningParser.splitForWrapping(node.textContent);
      ensureSentenceSpan(node, parts);
    }

    function getListType(element) {
      const list = element && element.closest ? element.closest('ol, ul') : null;
      return list ? list.tagName.toLowerCase() : null;
    }

    function getDepth(element) {
      let depth = 1;
      let cursor = element;
      while (cursor && cursor !== messageElement) {
        if (cursor.tagName && /OL|UL/.test(cursor.tagName)) {
          depth += 1;
        }
        cursor = cursor.parentElement;
      }
      return depth;
    }

    function getSectionTitle(element) {
      if (!element) return '';
      if (sectionCache.has(element)) return sectionCache.get(element);
      let current = element;
      while (current && current !== messageElement) {
        let sibling = current.previousElementSibling;
        while (sibling) {
          if (/^H[1-6]$/.test(sibling.tagName)) {
            const title = ReasoningParser.normalizeWhitespace(sibling.textContent || '');
            sectionCache.set(element, title);
            return title;
          }
          if (sibling.matches && sibling.matches('p, strong')) {
            const text = ReasoningParser.normalizeWhitespace(sibling.textContent || '');
            if (text && /^(pros|cons|conclusion|summary|bottom line)/i.test(text)) {
              sectionCache.set(element, text);
              return text;
            }
          }
          sibling = sibling.previousElementSibling;
        }
        current = current.parentElement;
      }
      sectionCache.set(element, '');
      return '';
    }

    if (segments.length) {
      const preview = segments[0].text.slice(0, 80);
      titleMap[messageId] = preview + (segments[0].text.length > 80 ? '…' : '');
    }
    return { segments, titleMap };
  }

  function applyFilterClasses() {
    if (!sidebar) return;
    sidebar.setFilters(currentState.filters);
    const svg = sidebar.getGraphSvg();
    if (!svg) return;
    svg.classList.toggle('hide-premise', !currentState.filters.premise);
    svg.classList.toggle('hide-logic', !currentState.filters.logic);
    svg.classList.toggle('hide-conclusion', !currentState.filters.conclusion);
  }

  function toggleSidebar() {
    setSidebarOpen(!currentState.open);
  }

  function setSidebarOpen(open) {
    currentState.open = open;
    sidebar.setOpen(open);
    if (hostElement) {
      hostElement.style.width = open ? `${currentState.width}px` : '32px';
    }
    saveState();
  }

  function getThreadId() {
    const match = window.location.pathname.match(/\/c\/([\w-]+)/);
    if (match) return match[1];
    return window.location.href.replace(/[?#].*$/, '');
  }

  async function loadState() {
    const key = `rv-state:${currentThreadId}`;
    try {
      const stored = await chrome.storage.sync.get(key);
      return stored[key] || null;
    } catch (error) {
      console.warn('Reasoning Visualizer state load failed', error);
      return null;
    }
  }

  function saveState() {
    const key = `rv-state:${currentThreadId}`;
    const payload = {
      open: currentState.open,
      width: currentState.width,
      filters: currentState.filters,
      depth: currentState.depth,
      simplify: currentState.simplify,
      activeMessage: currentState.activeMessage,
      contradictionsActive: currentState.contradictionsActive,
    };
    chrome.storage.sync.set({ [key]: payload }).catch((error) => {
      console.warn('Reasoning Visualizer state save failed', error);
    });
  }

  function resetForThread() {
    processedMessages = new WeakSet();
    messageGraphs.clear();
    sentenceMap.clear();
    messageOrder.length = 0;
    sidebar.clear();
    currentState = { ...BASE_STATE, filters: { ...FILTER_DEFAULT } };
    loadState().then((stored) => {
      if (stored) {
        currentState = { ...currentState, ...stored };
        if (stored.filters) {
          currentState.filters = { ...FILTER_DEFAULT, ...stored.filters };
        }
      }
      sidebar.setWidth(currentState.width);
      hostElement.style.width = currentState.open ? `${currentState.width}px` : '32px';
      sidebar.setOpen(currentState.open);
      sidebar.setDepth(currentState.depth);
      sidebar.setFilters(currentState.filters);
      sidebar.setSimplify(currentState.simplify);
      sidebar.setContradictionActive(currentState.contradictionsActive);
      processExistingMessages();
      renderActiveGraph();
      syncContradictionHighlights();
    });
  }

  function debounce(fn, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  async function renderActiveGraph() {
    if (!currentState.activeMessage) {
      sidebar.setStatus('No assistant reply selected');
      sidebar.renderGraph(null);
      return;
    }
    const entry = messageGraphs.get(currentState.activeMessage);
    if (!entry) {
      sidebar.setStatus('Waiting for assistant reply...');
      sidebar.renderGraph(null);
      return;
    }

    sidebar.setStatus('Rendering...');
    const baseGraph = entry.graph;
    const graph = ReasoningParser.pruneGraph(baseGraph, {
      depth: currentState.depth,
      simplify: currentState.simplify,
    });

    try {
      const mermaidText = ReasoningParser.graphToMermaid(graph);
      const svg = await renderMermaid(mermaidText, graph);
      sidebar.renderGraph(svg, {
        mermaidText,
        graph,
        filters: currentState.filters,
      });
      applyFilterClasses();
      syncSvgInteractions();
      syncContradictionHighlights();
      sidebar.setStatus(`Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`);
    } catch (error) {
      console.error('Mermaid render failed', error);
      sidebar.renderError(String(error));
    }
  }

  async function renderMermaid(mermaidText, graph) {
    const container = sidebar.getMermaidContainer();
    if (!container) throw new Error('Sidebar not ready');
    const mermaid = await ensureMermaid(container.getRootNode());
    const theme = detectTheme();
    mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme });
    const id = `rv-${Date.now()}`;
    const { svg } = await mermaid.render(id, mermaidText);
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const svgElement = doc.documentElement;
    svgElement.classList.add('rv-graph');
    svgElement.setAttribute('aria-label', 'Reasoning flowchart');
    if (graph) {
      graph.nodes.forEach((node) => {
        const nodeElement = svgElement.querySelector(`#${node.id}`);
        if (nodeElement) {
          nodeElement.dataset.rvSentenceId = node.sentenceId || '';
          nodeElement.dataset.rvNodeId = node.id;
        }
      });
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'rv-graph-wrapper';
    wrapper.appendChild(svgElement);
    return wrapper.innerHTML;
  }

  async function ensureMermaid(root) {
    if (mermaidApi) return mermaidApi;
    await loadMermaidScript(root);
    if (!window.mermaid) {
      throw new Error('Mermaid library unavailable');
    }
    mermaidApi = window.mermaid;
    return mermaidApi;
  }

  function loadMermaidScript(root) {
    return new Promise((resolve, reject) => {
      if (root.getElementById('rv-mermaid-lib')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = chrome.runtime.getURL('lib/mermaid.min.js');
      script.id = 'rv-mermaid-lib';
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      root.appendChild(script);
    });
  }

  function detectTheme() {
    const doc = document.documentElement;
    const attr = doc.getAttribute('data-theme') || doc.dataset.theme || '';
    if (/dark/i.test(attr)) return 'dark';
    const bodyColor = getComputedStyle(document.body).backgroundColor;
    const rgb = bodyColor.match(/\d+/g);
    if (!rgb) return 'default';
    const [r, g, b] = rgb.map((value) => parseInt(value, 10) / 255);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance < 0.5 ? 'dark' : 'default';
  }

  function syncContradictionHighlights() {
    sentenceMap.forEach((record) => {
      const { element } = record;
      if (!element) return;
      const isContradiction = element.textContent && /\b(however|but|although|nevertheless|yet|still|contradict|inconsistent)\b/i.test(element.textContent);
      element.classList.toggle('rv-contradiction', currentState.contradictionsActive && isContradiction);
    });
  }

  function handleExport(event) {
    const { kind } = event.detail;
    const graph = sidebar.getCurrentGraph();
    if (!graph) return;
    if (kind === 'copy-mermaid') {
      copyToClipboard(sidebar.getCurrentMermaid())
        .then(() => {
          sidebar.showToast('Mermaid copied to clipboard');
        })
        .catch((error) => {
          sidebar.showToast('Unable to copy Mermaid');
          console.warn(error);
        });
      return;
    }
    if (kind === 'download-svg') {
      const svg = sidebar.getGraphSvg();
      if (!svg) return;
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      downloadFile(new Blob([svgString], { type: 'image/svg+xml' }), 'reasoning-flowchart.svg');
      return;
    }
    if (kind === 'download-png') {
      const svg = sidebar.getGraphSvg();
      if (!svg) return;
      exportSvgToPng(svg).then((blob) => {
        downloadFile(blob, 'reasoning-flowchart.png');
      });
      return;
    }
    if (kind === 'download-json') {
      const json = ReasoningParser.exportGraphAsJson(graph);
      downloadFile(new Blob([json], { type: 'application/json' }), 'reasoning-flowchart.json');
      return;
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) {
          resolve();
        } else {
          reject(new Error('Copy command failed'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    requestAnimationFrame(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  function exportSvgToPng(svgElement) {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const scale = 2;
    return new Promise((resolve, reject) => {
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width * scale;
        canvas.height = image.height * scale;
        const context = canvas.getContext('2d');
        context.fillStyle = detectTheme() === 'dark' ? '#111' : '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) {
            reject(new Error('PNG export failed'));
            return;
          }
          resolve(pngBlob);
          URL.revokeObjectURL(url);
        }, 'image/png');
      };
      image.onerror = reject;
      image.src = url;
    });
  }

  function findAssistantMessage(node) {
    if (!node) return null;
    if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-message-author-role')) {
      if (node.getAttribute('data-message-author-role') === 'assistant') {
        return node;
      }
    }
    return node.querySelector?.('[data-message-author-role="assistant"]') || null;
  }

  function syncSvgInteractions() {
    const svg = sidebar.getGraphSvg();
    if (!svg) return;
    svg.addEventListener('click', (event) => {
      const node = event.target.closest('.node');
      if (!node) return;
      const sentenceId = node.dataset.rvSentenceId;
      scrollToSentence(sentenceId);
    });
    svg.addEventListener('mouseover', (event) => {
      const node = event.target.closest('.node');
      if (!node) return;
      const sentenceId = node.dataset.rvSentenceId;
      highlightSentence(sentenceId, true);
    });
    svg.addEventListener('mouseout', (event) => {
      const node = event.target.closest('.node');
      if (!node) return;
      const sentenceId = node.dataset.rvSentenceId;
      highlightSentence(sentenceId, false);
    });
  }

  function scrollToSentence(sentenceId) {
    if (!sentenceId) return;
    const record = sentenceMap.get(sentenceId);
    if (!record) return;
    const { element } = record;
    element.classList.add('rv-highlight');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      element.classList.remove('rv-highlight');
    }, 2000);
  }

  function highlightSentence(sentenceId, active) {
    if (!sentenceId) return;
    const record = sentenceMap.get(sentenceId);
    if (!record) return;
    record.element.classList.toggle('rv-highlight', active);
  }

  window.addEventListener('resize', debounce(() => {
    if (!sidebar) return;
    sidebar.refreshHeight();
  }, 250));

})();
