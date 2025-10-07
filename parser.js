(function () {
  if (window.ReasoningParser) {
    return;
  }

  const CONNECTOR_REGEX = /\b(because|since|due to|as a result|so that|therefore|thus|hence|consequently|leads to|result(?:s)? in)\b/i;
  const CONCLUSION_REGEX = /^(conclusion|bottom line|in short|therefore|so|thus|overall)\b/i;
  const CONCLUSION_END_REGEX = /(therefore|so|thus|hence|overall)$/i;
  const CONTRADICTION_REGEX = /\b(however|but|although|nevertheless|yet|still|contradict|inconsistent)\b/i;
  const PREMISE_HINT_REGEX = /\b(because|since|given that|due to|as|from)\b/i;
  const PRO_SECTION_REGEX = /\b(pros?|benefit|advantage|strength|positive)\b/i;
  const CON_SECTION_REGEX = /\b(cons?|risk|drawback|weakness|negative)\b/i;

  function normalizeWhitespace(text) {
    return text.replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  function tokenizeSentences(rawText) {
    if (!rawText) return [];
    const text = rawText.replace(/\s+/g, ' ').trim();
    if (!text) return [];
    const sentenceRegex = /[^.!?;]+[.!?;]?/g;
    const matches = text.match(sentenceRegex) || [];
    return matches
      .map((segment) => segment.trim())
      .filter(Boolean);
  }

  function splitForWrapping(rawText) {
    if (!rawText) return [];
    const parts = [];
    const regex = /([^.!?;]+[.!?;]*)(\s*)/g;
    let match;
    while ((match = regex.exec(rawText)) !== null) {
      const sentence = match[1].trim();
      const trailing = match[2] || '';
      if (sentence) {
        parts.push({ sentence, trailing });
      } else if (trailing) {
        const last = parts[parts.length - 1];
        if (last) {
          last.trailing += trailing;
        }
      }
    }
    if (!parts.length) {
      parts.push({ sentence: rawText.trim(), trailing: '' });
    }
    return parts;
  }

  function classifySegment(segment, index, segments) {
    const text = segment.text.trim();
    const previous = segments[index - 1];
    const next = segments[index + 1];

    if (!text) return 'logic';

    if (segment.section && CON_SECTION_REGEX.test(segment.section)) {
      return 'logic';
    }
    if (segment.section && PRO_SECTION_REGEX.test(segment.section)) {
      return 'premise';
    }

    if (segment.section && /conclusion/i.test(segment.section)) {
      return 'conclusion';
    }

    if (CONCLUSION_REGEX.test(text) || CONCLUSION_END_REGEX.test(text)) {
      return 'conclusion';
    }

    if (index === segments.length - 1 && segments.length > 1) {
      return 'conclusion';
    }

    if (PREMISE_HINT_REGEX.test(text) || (previous && CONNECTOR_REGEX.test(previous.text))) {
      return 'premise';
    }

    if (CONNECTOR_REGEX.test(text)) {
      return 'logic';
    }

    if (segment.listType === 'ol') {
      return 'logic';
    }

    if (segment.order <= 1) {
      return 'premise';
    }

    if (next && CONCLUSION_REGEX.test(next.text)) {
      return 'logic';
    }

    return 'logic';
  }

  function computeDepth(segment, index, segments) {
    let depth = segment.depthHint || 1;
    const typeBefore = segments.slice(0, index).map((seg) => seg.category);
    const logicCount = typeBefore.filter((type) => type === 'logic').length;
    if (segment.category === 'conclusion') {
      depth = Math.max(depth, 3 + Math.floor(logicCount / 2));
    } else if (segment.category === 'logic') {
      depth = Math.max(depth, 2 + logicCount);
    } else {
      depth = Math.max(depth, 1 + Math.floor(logicCount / 2));
    }
    return Math.min(depth, 6);
  }

  function buildGraph(segments) {
    const nodes = [];
    const edges = [];
    const counters = { premise: 1, logic: 1, conclusion: 1 };

    const decoratedSegments = segments.map((segment, index) => {
      const category = classifySegment(segment, index, segments);
      return { ...segment, category };
    });

    decoratedSegments.forEach((segment, index) => {
      const { category } = segment;
      const id = `${category.charAt(0).toUpperCase()}${counters[category]++}`;
      segment.nodeId = id;
      const label = sanitizeLabel(segment.text);
      const contradiction = CONTRADICTION_REGEX.test(segment.text);
      const node = {
        id,
        type: category,
        label,
        text: segment.text,
        sentenceId: segment.sentenceId,
        section: segment.section,
        depth: computeDepth(segment, index, decoratedSegments),
        contradiction,
      };
      nodes.push(node);

      if (index > 0) {
        const prev = decoratedSegments[index - 1];
        edges.push({ from: prev.nodeId, to: id, reason: 'sequence' });
      }

      if (CONNECTOR_REGEX.test(segment.text)) {
        let backIndex = index - 1;
        let linked = false;
        while (backIndex >= 0 && !linked) {
          const candidate = decoratedSegments[backIndex];
          if (candidate.category === 'premise' || candidate.category === 'logic') {
            edges.push({ from: candidate.nodeId, to: id, reason: 'causal' });
            linked = true;
          }
          backIndex -= 1;
        }
      }
    });

    const contradictions = nodes.filter((node) => node.contradiction);

    return {
      nodes,
      edges,
      contradictions,
      segments: decoratedSegments,
    };
  }

  function pruneGraph(graph, options) {
    const opts = Object.assign({ depth: 5, simplify: false }, options || {});
    const allowedNodes = graph.nodes.filter((node) => node.depth <= opts.depth);
    const simplifiedNodes = opts.simplify
      ? allowedNodes.filter((node) => !(node.type === 'logic' && wordCount(node.text) <= 6))
      : allowedNodes;
    const allowedIds = new Set(simplifiedNodes.map((node) => node.id));
    const edges = graph.edges.filter((edge) => allowedIds.has(edge.from) && allowedIds.has(edge.to));
    const contradictions = graph.contradictions.filter((node) => allowedIds.has(node.id));
    return {
      ...graph,
      nodes: simplifiedNodes,
      edges,
      contradictions,
    };
  }

  function wordCount(text) {
    return text ? text.trim().split(/\s+/).length : 0;
  }

  function sanitizeLabel(text) {
    return normalizeWhitespace(text).replace(/[<>]/g, (char) => ({ '<': '&lt;', '>': '&gt;' }[char]));
  }

  function graphToMermaid(graph) {
    const lines = ['flowchart TD'];
    graph.nodes.forEach((node) => {
      let label = node.label;
      if (node.contradiction) {
        label = `⚠ ${label}`;
      }
      lines.push(`  ${node.id}[${label}]`);
    });

    graph.edges.forEach((edge) => {
      const arrow = edge.reason === 'causal' ? '-->' : '-->';
      lines.push(`  ${edge.from} ${arrow} ${edge.to}`);
    });

    lines.push('  classDef premise fill:#E8F7FF,stroke:#5AB0E8,stroke-width:1px;');
    lines.push('  classDef logic fill:#F2F2FF,stroke:#8A8AE6,stroke-width:1px;');
    lines.push('  classDef conclusion fill:#EFFFF2,stroke:#5BC77D,stroke-width:1px;');
    lines.push('  classDef contradiction stroke:#C95A5A,stroke-width:2px;');

    graph.nodes.forEach((node) => {
      const classes = [node.type];
      if (node.contradiction) {
        classes.push('contradiction');
      }
      lines.push(`  class ${node.id} ${classes.join(',')};`);
    });

    return lines.join('\n');
  }

  function exportGraphAsJson(graph) {
    const payload = {
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        text: node.text,
        sentenceId: node.sentenceId,
        section: node.section,
        depth: node.depth,
        contradiction: node.contradiction,
      })),
      edges: graph.edges.map((edge) => ({ from: edge.from, to: edge.to, reason: edge.reason })),
    };
    return JSON.stringify(payload, null, 2);
  }

  window.ReasoningParser = {
    normalizeWhitespace,
    tokenizeSentences,
    splitForWrapping,
    buildGraph,
    pruneGraph,
    graphToMermaid,
    exportGraphAsJson,
  };
})();
