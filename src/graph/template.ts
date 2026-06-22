import type { GraphData } from './build-graph.js';

export function generateHtml(data: GraphData): string {
  // Escape "<" so any "</script>" inside page HTML can't break out of the inline module.
  const jsonData = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lịch Sử Việt Nam — Bản đồ tri thức 3D</title>

  <!-- All ESM, pinned to ONE three@0.170.0 so the graph, SpriteText and bloom share an instance -->
  <script type="importmap">
  {
    "imports": {
      "three": "https://esm.sh/three@0.180.0",
      "three/": "https://esm.sh/three@0.180.0/",
      "three/addons/": "https://esm.sh/three@0.180.0/examples/jsm/",
      "three-spritetext": "https://esm.sh/three-spritetext@1.9.0?deps=three@0.180.0",
      "3d-force-graph": "https://esm.sh/3d-force-graph@1.80.0?deps=three@0.180.0"
    }
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;1,6..72,400&family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      /* ── Sơn mài (Vietnamese lacquer) palette ── */
      --lacquer: #0b0a08;
      --lacquer-deep: #070605;
      --surface: #14110d;
      --elevated: #1d1813;
      --panel: #13100c;
      --oxblood: #7a2a1c;
      --cinnabar: #c4452a;
      --gold-leaf: #d9b25a;
      --gold-bright: #eccd84;
      --gold-dim: #9a7e42;
      --eggshell: #ece3d0;
      --eggshell-dim: #a89f8c;
      --muted: #6b6253;
      --border: rgba(217, 178, 90, 0.14);
      --border-active: rgba(217, 178, 90, 0.34);

      /* node type colors → lacquer materials */
      --person: #d9b25a;   /* gold leaf */
      --dynasty: #c4452a;  /* cinnabar */
      --event: #cf7a3f;    /* terracotta */
      --place: #6f9a86;    /* Đông Sơn verdigris */
      --concept: #b9c2a6;  /* jade-eggshell */
      --era: #5d7aa0;      /* chàm indigo */

      --font-display: 'Newsreader', Georgia, serif;
      --font-body: 'Be Vietnam Pro', system-ui, sans-serif;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--font-body);
      background: var(--lacquer);
      color: var(--eggshell);
      height: 100vh;
      overflow: hidden;
    }

    /* Eggshell-inlay grain over the lacquer */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 5;
      mix-blend-mode: overlay;
    }

    /* ─── Header ─── */
    .header {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 28px;
      background: linear-gradient(180deg, rgba(20,17,13,0.95) 0%, rgba(11,10,8,0.9) 100%);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(12px);
    }

    .header-brand { display: flex; align-items: baseline; gap: 12px; }

    .header h1 {
      font-family: var(--font-display);
      font-size: 23px;
      font-weight: 700;
      color: var(--gold-leaf);
      letter-spacing: 0.01em;
    }

    .header .subtitle {
      font-size: 11px;
      font-weight: 300;
      color: var(--muted);
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .controls { display: flex; gap: 12px; align-items: center; }

    .controls select,
    .controls input {
      padding: 8px 14px;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: var(--elevated);
      color: var(--eggshell);
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 300;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }

    .controls select:focus,
    .controls input:focus {
      border-color: var(--gold-dim);
      box-shadow: 0 0 0 2px rgba(217, 178, 90, 0.1);
    }

    .controls input { width: 220px; }
    .controls input::placeholder { color: var(--muted); font-style: italic; }

    .node-count { font-size: 11px; color: var(--muted); font-weight: 300; letter-spacing: 0.05em; }
    .node-count strong { color: var(--gold-dim); font-weight: 500; }

    /* ─── Main Layout ─── */
    .main {
      position: relative;
      z-index: 1;
      display: flex;
      height: calc(100vh - 57px - 44px);
    }

    /* ─── Graph ─── */
    .graph-container {
      flex: 1;
      position: relative;
      overflow: hidden;
      min-width: 0;
      cursor: grab;
      background: radial-gradient(ellipse at 50% 45%, rgba(122,42,28,0.10) 0%, rgba(11,10,8,0) 55%);
    }
    .graph-container:active { cursor: grabbing; }
    .graph-container canvas { display: block; }

    /* WebGL-absent notice */
    .webgl-fallback {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 40px;
      text-align: center;
      color: var(--eggshell-dim);
    }
    .webgl-fallback h2 {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 22px;
      color: var(--gold-leaf);
    }
    .webgl-fallback p { font-size: 14px; font-weight: 300; max-width: 420px; line-height: 1.7; }

    /* ─── Side Panel ─── */
    .side-panel {
      width: 420px;
      min-width: 420px;
      flex-shrink: 0;
      background: var(--panel);
      border-left: 1px solid var(--border);
      overflow-y: auto;
      display: none;
      position: relative;
    }
    .side-panel.open { display: flex; flex-direction: column; animation: panelSlide 0.3s ease-out; }

    @keyframes panelSlide {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .panel-header {
      padding: 28px 28px 20px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(122,42,28,0.10) 0%, transparent 100%);
    }

    .panel-header h2 {
      font-family: var(--font-display);
      font-size: 27px;
      font-weight: 700;
      color: var(--eggshell);
      line-height: 1.2;
      margin-bottom: 10px;
    }

    .panel-meta { display: flex; align-items: center; gap: 10px; }

    .type-badge {
      display: inline-block;
      padding: 3px 12px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #1a120c;
    }

    .era-label { font-size: 11px; color: var(--muted); font-style: italic; }

    .panel-body { flex: 1; padding: 24px 28px 40px; overflow-y: auto; }

    .panel-body .page-content {
      font-size: 15px;
      line-height: 1.85;
      color: var(--eggshell-dim);
      font-weight: 300;
    }

    .panel-body .page-content h2 {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 600;
      color: var(--gold-leaf);
      margin-top: 28px;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border);
    }
    .panel-body .page-content h2:first-child { margin-top: 0; }
    .panel-body .page-content p { margin-bottom: 14px; }
    .panel-body .page-content ul { padding-left: 18px; margin-bottom: 14px; }
    .panel-body .page-content li { margin-bottom: 6px; }
    .panel-body .page-content strong { color: var(--eggshell); font-weight: 500; }

    .panel-body .page-content a.wiki-link {
      color: var(--gold-leaf);
      cursor: pointer;
      text-decoration: none;
      border-bottom: 1px solid rgba(217, 178, 90, 0.28);
      transition: border-color 0.2s, color 0.2s;
    }
    .panel-body .page-content a.wiki-link:hover { color: var(--gold-bright); border-bottom-color: var(--gold-bright); }

    .panel-close {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 28px;
      height: 28px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--elevated);
      color: var(--muted);
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.2s, color 0.2s;
      z-index: 3;
    }
    .panel-close:hover { border-color: var(--border-active); color: var(--eggshell); }

    /* ─── Scrollbar ─── */
    .panel-body::-webkit-scrollbar { width: 5px; }
    .panel-body::-webkit-scrollbar-track { background: transparent; }
    .panel-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    .panel-body::-webkit-scrollbar-thumb:hover { background: var(--border-active); }

    /* ─── Legend ─── */
    .legend {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 10px 20px;
      background: linear-gradient(0deg, rgba(11,10,8,0.95) 0%, rgba(20,17,13,0.9) 100%);
      border-top: 1px solid var(--border);
      font-size: 11px;
      font-weight: 300;
      letter-spacing: 0.05em;
      color: var(--muted);
    }

    .legend-item { display: flex; align-items: center; gap: 6px; cursor: default; transition: color 0.2s; }
    .legend-item:hover { color: var(--eggshell-dim); }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }

    /* ─── Empty State ─── */
    .empty-hint {
      position: absolute;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      color: var(--muted);
      font-style: italic;
      pointer-events: none;
      opacity: 0.6;
      letter-spacing: 0.05em;
      z-index: 2;
      animation: fadeHint 4s ease-in-out infinite;
    }
    @keyframes fadeHint { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }

    /* ─── Mobile: side panel as bottom sheet ─── */
    @media (max-width: 768px) {
      .header { padding: 10px 14px; flex-wrap: wrap; gap: 8px; }
      .header h1 { font-size: 18px; }
      .header .subtitle { display: none; }
      .controls { width: 100%; gap: 8px; }
      .controls input { flex: 1; width: auto; min-width: 0; }
      .node-count { display: none; }

      .main { flex-direction: column; height: calc(100vh - 90px - 44px); }
      .graph-container { flex: 1; min-height: 0; }

      .side-panel {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        width: 100%;
        min-width: 0;
        max-height: 60vh;
        border-left: none;
        border-top: 1px solid var(--border-active);
        border-radius: 16px 16px 0 0;
        z-index: 20;
        box-shadow: 0 -8px 40px rgba(0,0,0,0.6);
      }
      .side-panel.open { animation: sheetSlide 0.3s ease-out; }
      @keyframes sheetSlide {
        from { opacity: 0; transform: translateY(100%); }
        to { opacity: 1; transform: translateY(0); }
      }

      .panel-header::before {
        content: '';
        display: block;
        width: 36px; height: 4px;
        background: var(--muted);
        border-radius: 2px;
        margin: 0 auto 14px;
        opacity: 0.5;
      }
      .panel-header { padding: 14px 20px 14px; }
      .panel-header h2 { font-size: 22px; }
      .panel-body { padding: 16px 20px 32px; }
      .panel-body .page-content { font-size: 14px; line-height: 1.75; }
      .panel-close { top: 12px; right: 12px; }

      .legend { gap: 12px; padding: 8px 12px; font-size: 10px; flex-wrap: wrap; }
      .empty-hint { bottom: 16px; font-size: 11px; }
    }

    @media (max-width: 420px) {
      .header h1 { font-size: 16px; }
      .controls select { font-size: 12px; padding: 6px 8px; }
      .controls input { font-size: 12px; padding: 6px 8px; }
      .side-panel { max-height: 70vh; }
      .panel-header h2 { font-size: 19px; }
      .panel-body .page-content { font-size: 13px; }
      .legend { gap: 8px; font-size: 9px; }
      .legend-dot { width: 6px; height: 6px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-brand">
      <h1>Lịch Sử Việt Nam</h1>
      <span class="subtitle">Bản đồ tri thức · 3D</span>
    </div>
    <div class="controls">
      <span class="node-count"><strong id="nodeCount">0</strong> nút &middot; <strong id="edgeCount">0</strong> liên kết</span>
      <select id="typeFilter">
        <option value="all">Tất cả</option>
        <option value="person">Nhân vật</option>
        <option value="concept">Văn hóa</option>
        <option value="dynasty">Triều đại</option>
        <option value="event">Sự kiện</option>
        <option value="place">Địa danh</option>
        <option value="era">Thời kỳ</option>
      </select>
      <input type="text" id="searchBox" placeholder="Tìm kiếm...">
    </div>
  </div>

  <div class="main">
    <div class="graph-container" id="graph">
      <div class="empty-hint">Kéo để xoay · cuộn để phóng · chạm vào một nút để khám phá</div>
    </div>
    <div class="side-panel" id="sidePanel">
      <button class="panel-close" id="panelClose">&times;</button>
      <div class="panel-header">
        <h2 id="pageTitle"></h2>
        <div class="panel-meta">
          <span class="type-badge" id="typeBadge"></span>
          <span class="era-label" id="eraLabel"></span>
        </div>
      </div>
      <div class="panel-body">
        <div class="page-content" id="pageContent"></div>
      </div>
    </div>
  </div>

  <div class="legend">
    <div class="legend-item"><div class="legend-dot" style="color:var(--person);background:var(--person)"></div> Nhân vật</div>
    <div class="legend-item"><div class="legend-dot" style="color:var(--concept);background:var(--concept)"></div> Văn hóa</div>
    <div class="legend-item"><div class="legend-dot" style="color:var(--dynasty);background:var(--dynasty)"></div> Triều đại</div>
    <div class="legend-item"><div class="legend-dot" style="color:var(--event);background:var(--event)"></div> Sự kiện</div>
    <div class="legend-item"><div class="legend-dot" style="color:var(--place);background:var(--place)"></div> Địa danh</div>
    <div class="legend-item"><div class="legend-dot" style="color:var(--era);background:var(--era)"></div> Thời kỳ</div>
  </div>

  <script type="module">
    import * as THREE from 'three';
    import SpriteText from 'three-spritetext';
    import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
    import ForceGraph3D from '3d-force-graph';

    const WIKI_DATA = ${jsonData};

    const TYPE_COLORS = {
      person: '#d9b25a', concept: '#b9c2a6', dynasty: '#c4452a',
      event: '#cf7a3f', place: '#6f9a86', era: '#5d7aa0'
    };
    const TYPE_LABELS = {
      person: 'Nhân vật', concept: 'Văn hóa', dynasty: 'Triều đại',
      event: 'Sự kiện', place: 'Địa danh', era: 'Thời kỳ'
    };

    document.getElementById('nodeCount').textContent = WIKI_DATA.nodes.length;
    document.getElementById('edgeCount').textContent = WIKI_DATA.edges.length;

    const container = document.getElementById('graph');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const enableBloom = !reduceMotion && !isMobile;

    // ── WebGL guard ──
    function hasWebGL() {
      try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
      } catch (e) { return false; }
    }

    if (!hasWebGL()) {
      container.innerHTML = '<div class="webgl-fallback">'
        + '<h2>Trình duyệt chưa hỗ trợ WebGL</h2>'
        + '<p>Bản đồ tri thức 3D cần WebGL để hiển thị. Hãy thử bật tăng tốc phần cứng hoặc dùng trình duyệt khác (Chrome, Firefox, Safari, Edge).</p>'
        + '</div>';
    } else {
      buildGraph();
    }

    function resolveNodeId(title) {
      return title.toLowerCase().replace(/\\s+/g, '-');
    }

    function buildGraph() {
      const nodes = WIKI_DATA.nodes.map(d => ({ ...d }));
      // build-graph emits "edges"; the 3D library wants "links"
      const links = WIKI_DATA.edges.map(e => ({ source: e.source, target: e.target }));

      const connCount = {};
      nodes.forEach(n => { connCount[n.id] = 0; });
      links.forEach(e => {
        connCount[e.source] = (connCount[e.source] || 0) + 1;
        connCount[e.target] = (connCount[e.target] || 0) + 1;
      });
      const nodeById = new Map(nodes.map(n => [n.id, n]));

      function radius(n) { return Math.max(2, Math.min(9, 2 + (connCount[n.id] || 0) * 0.7)); }
      function endId(v) { return (v && typeof v === 'object') ? v.id : v; }

      // highlight state
      const highlightNodes = new Set();
      const highlightLinks = new Set();
      let selectedId = null;

      const sphereGeo = new THREE.SphereGeometry(1, 16, 16);

      function applyNodeStyle(n) {
        if (!n.__mat) return;
        const active = highlightNodes.size === 0 || highlightNodes.has(n.id);
        n.__mat.opacity = active ? 1 : 0.1;
        if (n.__sprite) n.__sprite.material.opacity = active ? 0.92 : 0.05;
      }

      function nodeObject(n) {
        if (!n.__obj) {
          const group = new THREE.Group();
          const mat = new THREE.MeshBasicMaterial({
            color: TYPE_COLORS[n.type] || '#cccccc', transparent: true
          });
          const mesh = new THREE.Mesh(sphereGeo, mat);
          const r = radius(n);
          mesh.scale.setScalar(r);
          const sprite = new SpriteText(n.title);
          sprite.color = '#ece3d0';
          sprite.textHeight = 6;
          sprite.fontFace = 'Newsreader, Georgia, serif';
          sprite.fontWeight = '600';
          sprite.material.depthWrite = false;
          sprite.center.set(0.5, 0);
          sprite.position.set(0, r + 3, 0);
          group.add(mesh);
          group.add(sprite);
          n.__obj = group; n.__mat = mat; n.__sprite = sprite;
        }
        applyNodeStyle(n);
        return n.__obj;
      }

      const Graph = new ForceGraph3D(container)
        .backgroundColor('#0b0a08')
        .graphData({ nodes, links })
        .nodeThreeObject(nodeObject)
        .nodeLabel(n =>
          '<div style="font-family:Be Vietnam Pro,sans-serif;background:#1d1813;'
          + 'border:1px solid rgba(217,178,90,0.34);border-radius:4px;padding:8px 12px;'
          + 'box-shadow:0 8px 32px rgba(0,0,0,0.6);max-width:220px">'
          + '<div style="font-family:Newsreader,serif;font-size:15px;font-weight:600;color:#ece3d0">' + n.title + '</div>'
          + '<div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#6b6253;margin-top:3px">'
          + (TYPE_LABELS[n.type] || n.type) + ' &middot; ' + n.era + '</div></div>'
        )
        .linkColor(l => highlightLinks.has(l)
          ? 'rgba(236,205,132,0.65)'
          : (highlightNodes.size ? 'rgba(217,178,90,0.04)' : 'rgba(217,178,90,0.16)'))
        .linkWidth(l => highlightLinks.has(l) ? 0.8 : 0.3)
        .linkDirectionalParticles(l => (highlightLinks.has(l) && !reduceMotion) ? 2 : 0)
        .linkDirectionalParticleWidth(1.4)
        .linkDirectionalParticleColor(() => '#eccd84')
        .enableNodeDrag(!isMobile)
        .onNodeClick(selectNode)
        .onBackgroundClick(closePanel);

      // Warm lacquer depth — oxblood fog instead of cold black (the signature)
      Graph.scene().fog = new THREE.FogExp2(0x140a06, 0.0008);

      // force tuning
      Graph.d3Force('charge').strength(-130);
      Graph.d3Force('link').distance(42);

      if (enableBloom) {
        const bloom = new UnrealBloomPass();
        bloom.strength = 0.5;
        bloom.radius = 0.55;
        bloom.threshold = 0.28;
        Graph.postProcessingComposer().addPass(bloom);
      }
      if (reduceMotion) Graph.cooldownTime(4000);

      function resizeGraph() {
        Graph.width(container.clientWidth).height(container.clientHeight);
      }
      window.addEventListener('resize', resizeGraph);

      function computeHighlight(node) {
        highlightNodes.clear();
        highlightLinks.clear();
        if (!node) return;
        highlightNodes.add(node.id);
        links.forEach(l => {
          const s = endId(l.source), t = endId(l.target);
          if (s === node.id || t === node.id) {
            highlightLinks.add(l);
            highlightNodes.add(s);
            highlightNodes.add(t);
          }
        });
      }

      function focusNode(node) {
        const dist = 140 + radius(node) * 6;
        const n = Math.hypot(node.x || 0, node.y || 0, node.z || 0) || 1;
        const ratio = 1 + dist / n;
        Graph.cameraPosition(
          { x: (node.x || 0) * ratio, y: (node.y || 0) * ratio, z: (node.z || 0) * ratio },
          node,
          reduceMotion ? 0 : 800
        );
      }

      function selectNode(node) {
        if (!node) return;
        selectedId = node.id;
        computeHighlight(node);
        Graph.refresh();
        showPage(node);
        focusNode(node);
        const hint = document.querySelector('.empty-hint');
        if (hint) hint.style.display = 'none';
      }

      function showPage(d) {
        const panel = document.getElementById('sidePanel');
        document.getElementById('pageTitle').textContent = d.title;

        const badge = document.getElementById('typeBadge');
        badge.textContent = TYPE_LABELS[d.type] || d.type;
        badge.style.background = TYPE_COLORS[d.type] || '#888';

        document.getElementById('eraLabel').textContent = d.era;

        let html = WIKI_DATA.pages[d.id] || '<p>Chưa có nội dung.</p>';
        html = html.replace(/\\[\\[([^\\]]+)\\]\\]/g, (_, title) => {
          const targetId = resolveNodeId(title);
          return '<a class="wiki-link" data-target="' + targetId + '" onclick="navigateTo(\\'' + targetId + '\\')">' + title + '</a>';
        });
        document.getElementById('pageContent').innerHTML = html;
        panel.classList.add('open');
        requestAnimationFrame(resizeGraph);
      }

      function closePanel() {
        document.getElementById('sidePanel').classList.remove('open');
        selectedId = null;
        highlightNodes.clear();
        highlightLinks.clear();
        Graph.refresh();
        requestAnimationFrame(resizeGraph);
      }

      window.navigateTo = function (targetId) {
        const target = nodeById.get(targetId);
        if (target) selectNode(target);
      };

      document.getElementById('panelClose').addEventListener('click', closePanel);

      // Type filter — swap the visible subgraph (positions preserved by reusing node objects)
      function reframe() {
        setTimeout(() => Graph.zoomToFit(reduceMotion ? 0 : 700, 70), 350);
      }
      document.getElementById('typeFilter').addEventListener('change', (e) => {
        const type = e.target.value;
        if (type === 'all') {
          Graph.graphData({ nodes, links });
        } else {
          const fnodes = nodes.filter(n => n.type === type);
          const ids = new Set(fnodes.map(n => n.id));
          const flinks = links.filter(l => ids.has(endId(l.source)) && ids.has(endId(l.target)));
          Graph.graphData({ nodes: fnodes, links: flinks });
        }
        reframe();
      });

      // Search — focus first title match
      document.getElementById('searchBox').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        if (!q) return;
        const match = nodes.find(n => n.title.toLowerCase().includes(q));
        if (match) selectNode(match);
      });
    }
  </script>
</body>
</html>`;
}
