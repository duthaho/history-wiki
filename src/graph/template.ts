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

  <!-- All ESM, pinned to ONE three@0.180.0 so the graph and SpriteText share an instance -->
  <script type="importmap">
  {
    "imports": {
      "three": "https://esm.sh/three@0.180.0",
      "three/": "https://esm.sh/three@0.180.0/",
      "three-spritetext": "https://esm.sh/three-spritetext@1.9.0?deps=three@0.180.0",
      "3d-force-graph": "https://esm.sh/3d-force-graph@1.80.0?deps=three@0.180.0",
      "d3-force-3d": "https://esm.sh/d3-force-3d@3"
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

    .controls { display: flex; gap: 14px; align-items: center; }

    .node-count { font-size: 11px; color: var(--muted); font-weight: 300; letter-spacing: 0.05em; }
    .node-count strong { color: var(--gold-dim); font-weight: 500; }

    /* ─── Search (the primary entry point) ─── */
    .search-wrap { position: relative; }

    .search-wrap input {
      width: 280px;
      padding: 9px 14px;
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
    .search-wrap input:focus {
      border-color: var(--gold-dim);
      box-shadow: 0 0 0 2px rgba(217, 178, 90, 0.1);
    }
    .search-wrap input::placeholder { color: var(--muted); font-style: italic; }

    .search-results {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 320px;
      max-height: 340px;
      overflow-y: auto;
      background: var(--elevated);
      border: 1px solid var(--border-active);
      border-radius: 6px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
      display: none;
      z-index: 40;
    }
    .search-results.open { display: block; }

    .search-result {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 100%;
      text-align: left;
      padding: 10px 13px;
      background: none;
      border: none;
      border-bottom: 1px solid var(--border);
      color: var(--eggshell-dim);
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 300;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .search-result:last-child { border-bottom: none; }
    .search-result:hover, .search-result.hl { background: rgba(217,178,90,0.08); color: var(--eggshell); }
    .search-result .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .search-result .ty { margin-left: auto; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); flex-shrink: 0; }

    /* ─── Main Layout ─── */
    .main {
      position: relative;
      z-index: 1;
      display: flex;
      height: calc(100vh - 57px - 44px);
    }

    /* ─── Graph ─── */
    /* The library owns #graph's innerHTML, so overlays (trail, hint) live on the wrapper. */
    .graph-wrap {
      flex: 1;
      position: relative;
      overflow: hidden;
      min-width: 0;
      background: radial-gradient(ellipse at 50% 45%, rgba(122,42,28,0.10) 0%, rgba(11,10,8,0) 55%);
    }
    .graph-container {
      position: absolute;
      inset: 0;
      cursor: grab;
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

    /* ─── Breadcrumb trail of visited nodes ─── */
    .trail {
      position: absolute;
      top: 14px;
      left: 16px;
      z-index: 3;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      max-width: 62%;
    }
    .trail-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 11px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: rgba(19,16,12,0.82);
      backdrop-filter: blur(6px);
      color: var(--eggshell-dim);
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 300;
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s;
      max-width: 180px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .trail-chip:hover { color: var(--eggshell); border-color: var(--border-active); }
    .trail-chip.current { color: var(--gold-leaf); border-color: var(--border-active); }
    .trail-chip .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

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

    /* Direct connections — list-first navigation */
    .related {
      padding: 14px 28px 16px;
      border-bottom: 1px solid var(--border);
    }
    .related-title {
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 10px;
    }
    .related-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .rel-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 3px;
      border: 1px solid var(--border);
      background: var(--elevated);
      color: var(--eggshell-dim);
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 300;
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s;
    }
    .rel-chip:hover { color: var(--eggshell); border-color: var(--border-active); }
    .rel-chip .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .rel-more { border-style: dashed; color: var(--muted); }
    .rel-more:hover { color: var(--eggshell-dim); }

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
    .panel-body::-webkit-scrollbar, .search-results::-webkit-scrollbar { width: 5px; }
    .panel-body::-webkit-scrollbar-track, .search-results::-webkit-scrollbar-track { background: transparent; }
    .panel-body::-webkit-scrollbar-thumb, .search-results::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    .panel-body::-webkit-scrollbar-thumb:hover { background: var(--border-active); }

    /* ─── Legend = filter + focus controls ─── */
    .legend {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 8px 20px;
      background: linear-gradient(0deg, rgba(11,10,8,0.95) 0%, rgba(20,17,13,0.9) 100%);
      border-top: 1px solid var(--border);
      font-size: 11px;
      font-weight: 300;
      letter-spacing: 0.05em;
      color: var(--muted);
    }

    .legend-filters { display: flex; align-items: center; gap: 16px; }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      background: none;
      border: none;
      padding: 4px 2px;
      color: var(--muted);
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 300;
      letter-spacing: 0.05em;
      transition: color 0.2s, opacity 0.2s;
    }
    .legend-item:hover { color: var(--eggshell-dim); }
    .legend-item.off { opacity: 0.32; }
    .legend-item.off .legend-dot { background: transparent !important; box-shadow: none; border: 1px solid currentColor; }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }

    .focus-ctl {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 4px;
      padding-left: 18px;
      border-left: 1px solid var(--border);
      transition: opacity 0.2s;
    }
    .focus-ctl.disabled { opacity: 0.35; pointer-events: none; }
    .focus-label { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
    .focus-btn {
      padding: 3px 10px;
      border-radius: 3px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--eggshell-dim);
      font-family: var(--font-body);
      font-size: 10px;
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s, background 0.2s;
    }
    .focus-btn:hover { border-color: var(--border-active); }
    .focus-btn.active { border-color: var(--border-active); color: var(--gold-leaf); background: rgba(217,178,90,0.08); }

    /* ─── Controls hint ─── */
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
      transition: opacity 0.8s;
    }
    .empty-hint.gone { opacity: 0 !important; animation: none; }
    @keyframes fadeHint { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }

    /* ─── Mobile: side panel as bottom sheet ─── */
    @media (max-width: 768px) {
      .header { padding: 10px 14px; flex-wrap: wrap; gap: 8px; }
      .header h1 { font-size: 18px; }
      .header .subtitle { display: none; }
      .controls { width: 100%; gap: 8px; }
      .search-wrap { flex: 1; }
      .search-wrap input { width: 100%; min-width: 0; }
      .search-results { left: 0; right: 0; width: auto; }
      .node-count { display: none; }

      .main { flex-direction: column; height: calc(100vh - 90px - 44px); }
      .graph-wrap { flex: 1; min-height: 0; }

      .trail { top: 10px; left: 10px; max-width: 84%; }
      .trail-chip { font-size: 10px; padding: 3px 9px; max-width: 130px; }

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
      .related { padding: 10px 20px 12px; }
      .panel-body { padding: 16px 20px 32px; }
      .panel-body .page-content { font-size: 14px; line-height: 1.75; }
      .panel-close { top: 12px; right: 12px; }

      .legend { gap: 10px; padding: 8px 10px; font-size: 10px; flex-wrap: wrap; }
      .legend-filters { gap: 10px; flex-wrap: wrap; justify-content: center; }
      .focus-ctl { padding-left: 10px; margin-left: 0; }
      .empty-hint { bottom: 16px; font-size: 11px; width: max-content; max-width: 92%; text-align: center; }
    }

    @media (max-width: 420px) {
      .header h1 { font-size: 16px; }
      .search-wrap input { font-size: 12px; padding: 7px 10px; }
      .side-panel { max-height: 70vh; }
      .panel-header h2 { font-size: 19px; }
      .panel-body .page-content { font-size: 13px; }
      .legend-filters { gap: 8px; }
      .legend-item { font-size: 9px; }
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
      <div class="search-wrap">
        <input type="text" id="searchBox" placeholder="Tìm nhân vật, triều đại, sự kiện…" autocomplete="off">
        <div class="search-results" id="searchResults"></div>
      </div>
    </div>
  </div>

  <div class="main">
    <div class="graph-wrap">
      <div class="graph-container" id="graph"></div>
      <div class="trail" id="trail"></div>
      <div class="empty-hint" id="hint">Kéo để xoay · cuộn để thu phóng · chạm vào một điểm sáng để khám phá</div>
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
      <div class="related" id="relatedWrap">
        <div class="related-title">Liên kết trực tiếp</div>
        <div class="related-chips" id="relatedChips"></div>
      </div>
      <div class="panel-body">
        <div class="page-content" id="pageContent"></div>
      </div>
    </div>
  </div>

  <div class="legend">
    <div class="legend-filters" id="legendFilters">
      <button class="legend-item" data-type="person"><div class="legend-dot" style="color:var(--person);background:var(--person)"></div> Nhân vật</button>
      <button class="legend-item" data-type="concept"><div class="legend-dot" style="color:var(--concept);background:var(--concept)"></div> Văn hóa</button>
      <button class="legend-item" data-type="dynasty"><div class="legend-dot" style="color:var(--dynasty);background:var(--dynasty)"></div> Triều đại</button>
      <button class="legend-item" data-type="event"><div class="legend-dot" style="color:var(--event);background:var(--event)"></div> Sự kiện</button>
      <button class="legend-item" data-type="place"><div class="legend-dot" style="color:var(--place);background:var(--place)"></div> Địa danh</button>
      <button class="legend-item" data-type="era"><div class="legend-dot" style="color:var(--era);background:var(--era)"></div> Thời kỳ</button>
    </div>
    <div class="focus-ctl disabled" id="focusCtl">
      <span class="focus-label">Tập trung</span>
      <button class="focus-btn active" data-depth="0" title="Hiện toàn bộ bản đồ">Tắt</button>
      <button class="focus-btn" data-depth="1" title="Chỉ hiện các mục liên kết trực tiếp">1</button>
      <button class="focus-btn" data-depth="2" title="Hiện các mục cách tối đa 2 bước">2</button>
    </div>
  </div>

  <script type="module">
    import * as THREE from 'three';
    import SpriteText from 'three-spritetext';
    import ForceGraph3D from '3d-force-graph';
    import { forceCollide } from 'd3-force-3d';

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
    // Diacritic-insensitive search: "tran" matches "Trần"
    function normalize(s) {
      return s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/đ/g, 'd');
    }

    function buildGraph() {
      const nodes = WIKI_DATA.nodes.map(d => ({ ...d }));
      // build-graph emits "edges"; the 3D library wants "links"
      const links = WIKI_DATA.edges.map(e => ({ source: e.source, target: e.target }));

      const deg = {};
      const neighborsOf = {};
      nodes.forEach(n => { deg[n.id] = 0; neighborsOf[n.id] = []; });
      links.forEach(e => {
        deg[e.source] = (deg[e.source] || 0) + 1;
        deg[e.target] = (deg[e.target] || 0) + 1;
        if (neighborsOf[e.source]) neighborsOf[e.source].push(e.target);
        if (neighborsOf[e.target]) neighborsOf[e.target].push(e.source);
      });
      const nodeById = new Map(nodes.map(n => [n.id, n]));
      const HUB_DEG = 20; // ~26 dynasty/era hubs form the always-labeled skeleton
      nodes.forEach(n => {
        n.__deg = deg[n.id] || 0;
        n.__isHub = n.__deg >= HUB_DEG;
        n.__norm = normalize(n.title);
      });

      function radius(n) { return 2.5 + Math.sqrt(n.__deg || 1) * 1.05; }
      function endId(v) { return (v && typeof v === 'object') ? v.id : v; }

      // ── interaction state ──
      const highlightNodes = new Set();
      const highlightLinks = new Set();
      let selectedId = null;
      let hoverId = null;
      const activeTypes = new Set(Object.keys(TYPE_COLORS));
      let focusDepth = 0;
      let egoSet = null;
      const trail = [];

      // ── node objects: sphere + tiered label ──
      const sphereGeo = new THREE.SphereGeometry(1, 12, 12);

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
          // hubs are landmarks read from overview distance; leaves are read up close
          sprite.textHeight = n.__isHub ? 9 + Math.min(6, n.__deg * 0.12) : 6.5;
          sprite.fontFace = 'Newsreader, Georgia, serif';
          sprite.fontWeight = '600';
          sprite.material.depthWrite = false;
          sprite.material.transparent = true;
          sprite.center.set(0.5, 0);
          sprite.position.set(0, r + 2.5, 0);
          sprite.visible = n.__isHub;
          group.add(mesh);
          group.add(sprite);
          n.__obj = group; n.__mat = mat; n.__mesh = mesh; n.__sprite = sprite;
        }
        applyNodeStyle(n);
        return n.__obj;
      }

      function applyNodeStyle(n) {
        if (!n.__mat) return;
        const hasHl = highlightNodes.size > 0;
        const active = !hasHl || highlightNodes.has(n.id);
        // dim = low-alpha same hue, so nodes recede into the lacquer instead of graying out
        n.__mat.opacity = active ? 1 : 0.13;
        n.__mesh.scale.setScalar(radius(n) * (n.id === selectedId ? 1.35 : 1));
      }

      // ── label level-of-detail + adaptive fog ──
      const LABEL_NEAR = isMobile ? 240 : 320;
      let labelTick = 0;
      function updateLabels(force) {
        const now = performance.now();
        if (!force && now - labelTick < 120) return;
        labelTick = now;
        const cam = Graph.camera().position;
        // fog density follows camera distance: warm depth at every zoom, never a blackout
        fog.density = 0.5 / Math.max(400, Math.hypot(cam.x, cam.y, cam.z));
        const hasHl = highlightNodes.size > 0;
        for (const n of nodes) {
          const s = n.__sprite;
          if (!s || n.x === undefined) continue;
          let opacity = 0;
          if (hasHl) {
            opacity = highlightNodes.has(n.id) ? 0.96 : 0;
          } else if (n.__isHub) {
            opacity = 0.92;
          } else {
            const d = Math.hypot(cam.x - n.x, cam.y - n.y, cam.z - n.z);
            if (d < LABEL_NEAR) opacity = Math.min(1, (LABEL_NEAR - d) / 70) * 0.85;
          }
          s.visible = opacity > 0.04;
          s.material.opacity = opacity;
        }
      }

      // ── link styling: dim by color value (deterministic on dark bg), highlight by width+color+particles ──
      function linkColor(l) {
        if (highlightLinks.has(l)) return '#eccd84';
        return highlightNodes.size ? '#1b160e' : '#453722';
      }

      const Graph = new ForceGraph3D(container)
        .backgroundColor('#0b0a08')
        .showNavInfo(false)
        .graphData({ nodes, links })
        .nodeThreeObject(nodeObject)
        .nodeLabel(isMobile ? (() => '') : (n =>
          '<div style="font-family:Be Vietnam Pro,sans-serif;background:#1d1813;'
          + 'border:1px solid rgba(217,178,90,0.34);border-radius:4px;padding:8px 12px;'
          + 'box-shadow:0 8px 32px rgba(0,0,0,0.6);max-width:220px">'
          + '<div style="font-family:Newsreader,serif;font-size:15px;font-weight:600;color:#ece3d0">' + n.title + '</div>'
          + '<div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#6b6253;margin-top:3px">'
          + (TYPE_LABELS[n.type] || n.type) + ' &middot; ' + n.era + '</div></div>'
        ))
        .linkColor(linkColor)
        .linkOpacity(0.38)
        .linkWidth(l => highlightLinks.has(l) ? 1.6 : 0)
        .linkDirectionalParticles(l => (highlightLinks.has(l) && !reduceMotion) ? 2 : 0)
        .linkDirectionalParticleWidth(1.5)
        .linkDirectionalParticleColor(() => '#eccd84')
        .nodeVisibility(isNodeVisible)
        .linkVisibility(isLinkVisible)
        .enableNodeDrag(!isMobile)
        .warmupTicks(reduceMotion ? 200 : 90)
        .cooldownTicks(reduceMotion ? 0 : 220)
        .onNodeClick(selectNode)
        .onNodeHover(onHover)
        .onBackgroundClick(closePanel)
        .onEngineTick(() => updateLabels())
        .onEngineStop(onSettled);

      // Warm lacquer depth — oxblood fog instead of cold black (the signature)
      const fog = new THREE.FogExp2(0x140a06, 0.0006);
      Graph.scene().fog = fog;
      Graph.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));

      // ── force tuning: hubs spread apart, satellites cluster tight, labels get room ──
      Graph.d3Force('charge').strength(-140);
      Graph.d3Force('link').distance(l => {
        const s = nodeById.get(endId(l.source)), t = nodeById.get(endId(l.target));
        const sh = s && s.__isHub, th = t && t.__isHub;
        return (sh && th) ? 72 : (sh || th) ? 38 : 26;
      });
      Graph.d3Force('collide', forceCollide(n => radius(n) + 5));

      Graph.controls().addEventListener('change', () => updateLabels());

      // Frame the constellation on its 90th-percentile radius so a few outliers
      // don't push the camera out into the fog.
      function frameAll(ms) {
        let cx = 0, cy = 0, cz = 0, count = 0;
        nodes.forEach(nd => { if (nd.x !== undefined) { cx += nd.x; cy += nd.y; cz += nd.z; count++; } });
        if (!count) return;
        cx /= count; cy /= count; cz /= count;
        const dists = [];
        nodes.forEach(nd => { if (nd.x !== undefined) dists.push(Math.hypot(nd.x - cx, nd.y - cy, nd.z - cz)); });
        dists.sort((a, b) => a - b);
        const r = dists[Math.floor(dists.length * 0.9)] || 300;
        const dist = r * 1.5 + 120;
        const cam = Graph.camera().position;
        const len = Math.hypot(cam.x - cx, cam.y - cy, cam.z - cz) || 1;
        Graph.cameraPosition(
          { x: cx + (cam.x - cx) / len * dist, y: cy + (cam.y - cy) / len * dist, z: cz + (cam.z - cz) / len * dist },
          { x: cx, y: cy, z: cz },
          ms
        );
        setTimeout(() => updateLabels(true), ms + 100);
      }

      let didFrame = false;
      function onSettled() {
        if (didFrame) return;
        didFrame = true;
        frameAll(reduceMotion ? 0 : 900);
        if (!reduceMotion && !interacted) setTimeout(startOrbit, 1800);
      }

      // ── idle auto-orbit: demos 3D-ness until the first interaction ──
      let orbitTimer = null;
      let interacted = false;
      function startOrbit() {
        if (interacted || orbitTimer) return;
        const cam = Graph.camera().position;
        let angle = Math.atan2(cam.x, cam.z);
        const r = Math.hypot(cam.x, cam.z);
        const y = cam.y;
        orbitTimer = setInterval(() => {
          angle += 0.0009;
          Graph.cameraPosition({ x: r * Math.sin(angle), y: y, z: r * Math.cos(angle) });
          updateLabels();
        }, 40);
      }
      function stopOrbit() {
        interacted = true;
        if (orbitTimer) { clearInterval(orbitTimer); orbitTimer = null; }
        const hint = document.getElementById('hint');
        if (hint) hint.classList.add('gone');
      }
      container.addEventListener('pointerdown', stopOrbit);
      container.addEventListener('wheel', stopOrbit, { passive: true });

      function resizeGraph() {
        Graph.width(container.clientWidth).height(container.clientHeight);
      }
      window.addEventListener('resize', resizeGraph);

      // ── visibility: legend filters ∩ ego set (no sim re-heat) ──
      function isNodeVisible(n) {
        if (!activeTypes.has(n.type)) return false;
        if (egoSet && !egoSet.has(n.id)) return false;
        return true;
      }
      function isLinkVisible(l) {
        const s = nodeById.get(endId(l.source)), t = nodeById.get(endId(l.target));
        return !!(s && t && isNodeVisible(s) && isNodeVisible(t));
      }
      function refreshVisibility() {
        Graph.nodeVisibility(isNodeVisible).linkVisibility(isLinkVisible);
      }

      function computeEgo() {
        egoSet = null;
        if (!focusDepth || !selectedId) return;
        egoSet = new Set([selectedId]);
        let frontier = [selectedId];
        for (let d = 0; d < focusDepth; d++) {
          const next = [];
          frontier.forEach(id => (neighborsOf[id] || []).forEach(nb => {
            if (!egoSet.has(nb)) { egoSet.add(nb); next.push(nb); }
          }));
          frontier = next;
        }
      }

      // ── highlight (1-hop neighborhood) ──
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

      function restyle() {
        nodes.forEach(applyNodeStyle);
        updateLabels(true);
        // re-trigger link accessors without re-heating the simulation
        Graph.linkColor(linkColor)
          .linkWidth(Graph.linkWidth())
          .linkDirectionalParticles(Graph.linkDirectionalParticles());
      }

      function onHover(node) {
        if (isMobile || selectedId) return;
        hoverId = node ? node.id : null;
        container.style.cursor = node ? 'pointer' : 'grab';
        computeHighlight(node);
        restyle();
      }

      function focusNode(node) {
        const dist = 130 + radius(node) * 8;
        const n = Math.hypot(node.x || 0, node.y || 0, node.z || 0) || 1;
        const ratio = 1 + dist / n;
        Graph.cameraPosition(
          { x: (node.x || 0) * ratio, y: (node.y || 0) * ratio, z: (node.z || 0) * ratio },
          node,
          reduceMotion ? 0 : 1100
        );
        setTimeout(() => updateLabels(true), reduceMotion ? 50 : 1200);
      }

      // ── breadcrumb trail ──
      function addToTrail(node) {
        const i = trail.indexOf(node.id);
        if (i !== -1) trail.splice(i, 1);
        trail.unshift(node.id);
        if (trail.length > 5) trail.pop();
        renderTrail();
      }
      function renderTrail() {
        const el = document.getElementById('trail');
        el.innerHTML = '';
        trail.forEach(id => {
          const n = nodeById.get(id);
          if (!n) return;
          const chip = document.createElement('button');
          chip.className = 'trail-chip' + (id === selectedId ? ' current' : '');
          chip.innerHTML = '<span class="dot" style="background:' + (TYPE_COLORS[n.type] || '#888') + '"></span>' + n.title;
          chip.addEventListener('click', () => selectNode(n));
          el.appendChild(chip);
        });
      }

      function selectNode(node) {
        if (!node) return;
        stopOrbit();
        selectedId = node.id;
        // make sure the target's type filter is on
        if (!activeTypes.has(node.type)) {
          activeTypes.add(node.type);
          syncLegend();
        }
        computeHighlight(node);
        computeEgo();
        refreshVisibility();
        restyle();
        showPage(node);
        addToTrail(node);
        focusNode(node);
        document.getElementById('focusCtl').classList.remove('disabled');
      }

      function showPage(d) {
        const panel = document.getElementById('sidePanel');
        document.getElementById('pageTitle').textContent = d.title;

        const badge = document.getElementById('typeBadge');
        badge.textContent = TYPE_LABELS[d.type] || d.type;
        badge.style.background = TYPE_COLORS[d.type] || '#888';

        document.getElementById('eraLabel').textContent = d.era;

        renderRelated(d);

        let html = WIKI_DATA.pages[d.id] || '<p>Chưa có nội dung.</p>';
        html = html.replace(/\\[\\[([^\\]]+)\\]\\]/g, (_, title) => {
          const targetId = resolveNodeId(title);
          return '<a class="wiki-link" data-target="' + targetId + '" onclick="navigateTo(\\'' + targetId + '\\')">' + title + '</a>';
        });
        document.getElementById('pageContent').innerHTML = html;
        panel.classList.add('open');
        panel.scrollTop = 0;
        document.querySelector('.panel-body').scrollTop = 0;
        requestAnimationFrame(resizeGraph);
      }

      // clickable neighbor list — list-first navigation + accessibility fallback
      function renderRelated(d) {
        const wrap = document.getElementById('relatedWrap');
        const box = document.getElementById('relatedChips');
        box.innerHTML = '';
        // dedupe: pages often wikilink each other more than once
        const ids = Array.from(new Set(neighborsOf[d.id] || []));
        if (!ids.length) { wrap.style.display = 'none'; return; }
        wrap.style.display = '';
        ids.sort((a, b) => (deg[b] || 0) - (deg[a] || 0));
        const LIMIT = 10;
        function chipFor(id) {
          const n = nodeById.get(id);
          if (!n) return null;
          const c = document.createElement('button');
          c.className = 'rel-chip';
          c.innerHTML = '<span class="dot" style="background:' + (TYPE_COLORS[n.type] || '#888') + '"></span>' + n.title;
          c.addEventListener('click', () => selectNode(n));
          return c;
        }
        ids.slice(0, LIMIT).forEach(id => { const c = chipFor(id); if (c) box.appendChild(c); });
        if (ids.length > LIMIT) {
          const more = document.createElement('button');
          more.className = 'rel-chip rel-more';
          more.textContent = '+' + (ids.length - LIMIT) + ' khác';
          more.addEventListener('click', () => {
            more.remove();
            ids.slice(LIMIT).forEach(id => { const c = chipFor(id); if (c) box.appendChild(c); });
          });
          box.appendChild(more);
        }
      }

      function closePanel() {
        document.getElementById('sidePanel').classList.remove('open');
        selectedId = null;
        highlightNodes.clear();
        highlightLinks.clear();
        const hadEgo = !!egoSet;
        egoSet = null;
        refreshVisibility();
        restyle();
        renderTrail();
        document.getElementById('focusCtl').classList.add('disabled');
        if (hadEgo) frameAll(reduceMotion ? 0 : 800);
        requestAnimationFrame(resizeGraph);
      }

      window.navigateTo = function (targetId) {
        const target = nodeById.get(targetId);
        if (target) selectNode(target);
      };

      document.getElementById('panelClose').addEventListener('click', closePanel);
      window.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          document.getElementById('searchResults').classList.remove('open');
          closePanel();
        }
      });

      // ── legend = filter ──
      function syncLegend() {
        document.querySelectorAll('.legend-item').forEach(btn => {
          btn.classList.toggle('off', !activeTypes.has(btn.dataset.type));
        });
      }
      document.querySelectorAll('.legend-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = btn.dataset.type;
          if (activeTypes.has(t)) {
            if (activeTypes.size === 1) return; // never allow zero visible types
            activeTypes.delete(t);
          } else {
            activeTypes.add(t);
          }
          syncLegend();
          refreshVisibility();
        });
      });

      // ── focus (ego-graph) depth control ──
      document.querySelectorAll('.focus-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          focusDepth = parseInt(btn.dataset.depth, 10);
          document.querySelectorAll('.focus-btn').forEach(b => b.classList.toggle('active', b === btn));
          computeEgo();
          refreshVisibility();
          if (selectedId) {
            if (focusDepth) {
              Graph.zoomToFit(reduceMotion ? 0 : 800, 40, isNodeVisible);
              setTimeout(() => updateLabels(true), reduceMotion ? 50 : 900);
            } else {
              frameAll(reduceMotion ? 0 : 800);
            }
          }
        });
      });

      // ── search-first entry: suggestions fly you to your first node ──
      const searchBox = document.getElementById('searchBox');
      const searchResults = document.getElementById('searchResults');
      let matches = [];

      function renderSearch() {
        searchResults.innerHTML = '';
        if (!matches.length) { searchResults.classList.remove('open'); return; }
        matches.slice(0, 8).forEach((n, i) => {
          const item = document.createElement('button');
          item.className = 'search-result' + (i === 0 ? ' hl' : '');
          item.innerHTML = '<span class="dot" style="background:' + (TYPE_COLORS[n.type] || '#888') + '"></span>'
            + '<span class="t">' + n.title + '</span>'
            + '<span class="ty">' + (TYPE_LABELS[n.type] || n.type) + '</span>';
          // mousedown (not click) so it fires before the input blur hides the list
          item.addEventListener('mousedown', e => { e.preventDefault(); pickSearch(n); });
          searchResults.appendChild(item);
        });
        searchResults.classList.add('open');
      }

      function pickSearch(n) {
        searchResults.classList.remove('open');
        searchBox.value = n.title;
        searchBox.blur();
        selectNode(n);
      }

      searchBox.addEventListener('input', () => {
        const q = normalize(searchBox.value.trim());
        if (!q) { matches = []; renderSearch(); return; }
        matches = nodes
          .filter(n => n.__norm.includes(q))
          .sort((a, b) => {
            const ap = a.__norm.startsWith(q) ? 0 : 1;
            const bp = b.__norm.startsWith(q) ? 0 : 1;
            return ap - bp || (b.__deg - a.__deg);
          });
        renderSearch();
      });
      searchBox.addEventListener('keydown', e => {
        if (e.key === 'Enter' && matches.length) pickSearch(matches[0]);
      });
      searchBox.addEventListener('blur', () => {
        setTimeout(() => searchResults.classList.remove('open'), 150);
      });
      searchBox.addEventListener('focus', () => {
        if (matches.length && searchBox.value.trim()) renderSearch();
      });
    }
  </script>
</body>
</html>`;
}
