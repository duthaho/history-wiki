import type { GraphData } from './build-graph.js';
import type { CityLayout } from './city-layout.js';

/**
 * "Phố cổ tri thức" — the wiki as a lantern-lit night town.
 * Every page is a building in its era's district along one time avenue;
 * clicking a building drives a car there along the streets.
 * Self-contained static HTML, same deploy model as template.ts.
 */
export function generateCityHtml(data: GraphData, layout: CityLayout): string {
  // Escape "<" so any "</script>" inside page HTML can't break out of the inline module.
  const jsonData = JSON.stringify(data).replace(/</g, '\\u003c');
  const jsonLayout = JSON.stringify(layout).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lịch Sử Việt Nam — Phố cổ tri thức 3D</title>

  <script type="importmap">
  {
    "imports": {
      "three": "https://esm.sh/three@0.180.0",
      "three/": "https://esm.sh/three@0.180.0/",
      "three/addons/": "https://esm.sh/three@0.180.0/examples/jsm/",
      "three-spritetext": "https://esm.sh/three-spritetext@1.9.0?deps=three@0.180.0"
    }
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;1,6..72,400&family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      /* ── Daylight Hội An palette: paper, plaster, terracotta ── */
      --lacquer: #f2ecdf;            /* page background (sun-bleached paper) */
      --surface: #ece4d2;
      --elevated: #faf6ec;
      --panel: #f7f2e6;
      --oxblood: #7a2a1c;
      --cinnabar: #b93c22;
      --gold-leaf: #9c721c;          /* dark gold — legible on light ground */
      --gold-bright: #7f5c14;
      --gold-dim: #b08e4a;
      --eggshell: #2b241a;           /* primary text (dark umber) */
      --eggshell-dim: #5d5343;
      --muted: #8a7f6c;
      --border: rgba(122, 90, 40, 0.2);
      --border-active: rgba(122, 90, 40, 0.42);

      --person: #d9b25a;
      --dynasty: #c4452a;
      --event: #cf7a3f;
      --place: #6f9a86;
      --concept: #b9c2a6;
      --era: #5d7aa0;

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
      background: linear-gradient(180deg, rgba(250,246,236,0.96) 0%, rgba(242,236,223,0.92) 100%);
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
    .view-link {
      font-size: 11px;
      color: var(--eggshell-dim);
      text-decoration: none;
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 4px 12px;
      transition: color 0.2s, border-color 0.2s;
      white-space: nowrap;
    }
    .view-link:hover { color: var(--gold-leaf); border-color: var(--border-active); }

    .controls { display: flex; gap: 14px; align-items: center; }
    .node-count { font-size: 11px; color: var(--muted); font-weight: 300; letter-spacing: 0.05em; }
    .node-count strong { color: var(--gold-dim); font-weight: 500; }

    /* ─── Search ─── */
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
    .search-wrap input:focus { border-color: var(--gold-dim); box-shadow: 0 0 0 2px rgba(217,178,90,0.1); }
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
      box-shadow: 0 12px 40px rgba(80,55,25,0.22);
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

    /* ─── Main ─── */
    .main {
      position: relative;
      z-index: 1;
      display: flex;
      height: calc(100vh - 57px - 44px);
    }
    .city-wrap {
      flex: 1;
      position: relative;
      overflow: hidden;
      min-width: 0;
    }
    .city-container { position: absolute; inset: 0; cursor: grab; }
    .city-container:active { cursor: grabbing; }
    .city-container canvas { display: block; }

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
    .webgl-fallback h2 { font-family: var(--font-display); font-weight: 600; font-size: 22px; color: var(--gold-leaf); }
    .webgl-fallback p { font-size: 14px; font-weight: 300; max-width: 420px; line-height: 1.7; }

    /* ─── Trail ─── */
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
      background: rgba(250,246,236,0.85);
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

    /* ─── Drive overlay ─── */
    .drive-status {
      position: absolute;
      bottom: 26px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 4;
      display: none;
      align-items: center;
      gap: 12px;
      padding: 9px 10px 9px 18px;
      border-radius: 24px;
      border: 1px solid var(--border-active);
      background: rgba(250,246,236,0.92);
      backdrop-filter: blur(8px);
      font-size: 12.5px;
      color: var(--eggshell-dim);
      box-shadow: 0 10px 36px rgba(80,55,25,0.25);
    }
    .drive-status.on { display: flex; }
    .drive-status b { color: var(--gold-leaf); font-weight: 500; }
    .skip-btn {
      padding: 5px 14px;
      border-radius: 16px;
      border: 1px solid var(--border-active);
      background: rgba(217,178,90,0.1);
      color: var(--gold-leaf);
      font-family: var(--font-body);
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
      white-space: nowrap;
    }
    .skip-btn:hover { background: rgba(217,178,90,0.2); }

    /* ─── Hint ─── */
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

    /* ─── Drive-tour HUD ─── */
    .drive-hud {
      position: absolute;
      bottom: 18px;
      left: 16px;
      z-index: 3;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(250,246,236,0.88);
      backdrop-filter: blur(6px);
      font-size: 11px;
      line-height: 1.9;
      color: var(--eggshell-dim);
      letter-spacing: 0.03em;
    }
    .drive-hud b {
      display: inline-block;
      min-width: 16px;
      padding: 1px 5px;
      border: 1px solid var(--border-active);
      border-radius: 4px;
      background: var(--elevated);
      color: var(--eggshell);
      font-weight: 500;
      text-align: center;
      font-size: 10px;
    }

    .near-prompt {
      position: absolute;
      bottom: 78px;
      left: 50%;
      transform: translateX(-50%) translateY(6px);
      z-index: 4;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 16px;
      border-radius: 24px;
      border: 1px solid var(--border-active);
      background: rgba(250,246,236,0.94);
      color: var(--eggshell);
      font-family: var(--font-body);
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(80,55,25,0.28);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s, transform 0.2s;
    }
    .near-prompt.on { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
    .near-prompt .key {
      padding: 2px 8px;
      border: 1px solid var(--border-active);
      border-radius: 4px;
      background: var(--gold-leaf);
      color: #fff9ec;
      font-size: 11px;
      font-weight: 600;
    }
    .near-prompt b { color: var(--gold-bright); font-weight: 600; }

    .district-chip {
      position: absolute;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 3;
      padding: 5px 16px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: rgba(250,246,236,0.85);
      backdrop-filter: blur(6px);
      font-family: var(--font-display);
      font-size: 13px;
      font-weight: 600;
      color: var(--gold-bright);
      letter-spacing: 0.04em;
      display: none;
    }
    .district-chip.on { display: block; }

    .joystick {
      position: absolute;
      bottom: 24px;
      left: 22px;
      z-index: 6;
      width: 108px;
      height: 108px;
      border-radius: 50%;
      border: 2px solid var(--border-active);
      background: rgba(250,246,236,0.35);
      display: none;
      touch-action: none;
    }
    .joy-knob {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: rgba(156,114,28,0.75);
      border: 1px solid var(--border-active);
      transform: translate(-50%, -50%);
    }

    /* ─── Highlights list (H) ─── */
    .hl-panel {
      position: absolute;
      right: 16px;
      bottom: 18px;
      z-index: 5;
      width: 280px;
      padding: 12px 6px 8px;
      border-radius: 10px;
      border: 1px solid var(--border-active);
      background: rgba(250,246,236,0.94);
      backdrop-filter: blur(8px);
      box-shadow: 0 12px 40px rgba(80,55,25,0.25);
      display: none;
    }
    .hl-panel.on { display: block; }
    .hl-title {
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      padding: 0 10px 8px;
    }
    .hl-item {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 100%;
      text-align: left;
      padding: 7px 10px;
      background: none;
      border: none;
      border-radius: 6px;
      color: var(--eggshell-dim);
      font-family: var(--font-body);
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .hl-item:hover { background: rgba(156,114,28,0.1); color: var(--eggshell); }
    .hl-item .num {
      min-width: 18px;
      padding: 1px 4px;
      border: 1px solid var(--border-active);
      border-radius: 4px;
      background: var(--elevated);
      font-size: 10px;
      font-weight: 600;
      text-align: center;
      color: var(--gold-bright);
    }
    .hl-item .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .hl-item .era { margin-left: auto; font-size: 9.5px; color: var(--muted); font-style: italic; }

    /* ─── Pause overlay (Esc) ─── */
    .pause-overlay {
      position: absolute;
      inset: 0;
      z-index: 30;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(30,24,14,0.55);
      backdrop-filter: blur(3px);
    }
    .pause-overlay.on { display: flex; }
    .pause-card { text-align: center; }
    .pause-rows {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 34px;
    }
    .pause-row {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 12px;
      font-size: 17px;
      color: #f3ead6;
      font-family: var(--font-body);
      font-weight: 300;
      text-shadow: 0 1px 8px rgba(0,0,0,0.5);
    }
    .pause-row b {
      color: #ffd773;
      font-weight: 600;
      letter-spacing: 0.06em;
    }
    .pause-foot {
      font-size: 15px;
      color: #ffd773;
      font-family: var(--font-body);
      text-shadow: 0 1px 8px rgba(0,0,0,0.5);
    }
    @media (max-width: 768px) {
      .hl-panel { right: 8px; bottom: 8px; width: 240px; }
      .pause-row { font-size: 14px; }
      .pause-foot { font-size: 13px; }
    }

    /* ─── Side panel (shared with graph page) ─── */
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
    @keyframes panelSlide { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
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
      color: #fff9ec;
    }
    .era-label { font-size: 11px; color: var(--muted); font-style: italic; }

    .related { padding: 14px 28px 16px; border-bottom: 1px solid var(--border); }
    .related-title { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
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
    .panel-body .page-content { font-size: 15px; line-height: 1.85; color: var(--eggshell-dim); font-weight: 300; }
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

    .panel-body::-webkit-scrollbar, .search-results::-webkit-scrollbar { width: 5px; }
    .panel-body::-webkit-scrollbar-track, .search-results::-webkit-scrollbar-track { background: transparent; }
    .panel-body::-webkit-scrollbar-thumb, .search-results::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    /* ─── Bottom bar: type filters + era strip + overview ─── */
    .legend {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
      padding: 7px 16px;
      background: linear-gradient(0deg, rgba(250,246,236,0.96) 0%, rgba(242,236,223,0.92) 100%);
      border-top: 1px solid var(--border);
      font-size: 11px;
      font-weight: 300;
      letter-spacing: 0.05em;
      color: var(--muted);
    }
    .legend-filters { display: flex; align-items: center; gap: 14px; }
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

    .era-strip {
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 0 14px;
      border-left: 1px solid var(--border);
      border-right: 1px solid var(--border);
    }
    .era-seg {
      width: 16px;
      height: 10px;
      border-radius: 2px;
      border: 1px solid var(--border);
      background: rgba(217,178,90,0.07);
      cursor: pointer;
      padding: 0;
      transition: background 0.2s, border-color 0.2s;
    }
    .era-seg:hover { background: rgba(217,178,90,0.25); border-color: var(--border-active); }
    .era-seg.active { background: var(--gold-leaf); border-color: var(--gold-leaf); box-shadow: 0 0 8px rgba(217,178,90,0.5); }

    .overview-btn {
      padding: 4px 12px;
      border-radius: 3px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--eggshell-dim);
      font-family: var(--font-body);
      font-size: 10.5px;
      letter-spacing: 0.06em;
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s, background 0.2s;
    }
    .overview-btn:hover { border-color: var(--border-active); color: var(--gold-leaf); background: rgba(217,178,90,0.06); }

    /* ─── Mobile ─── */
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
      .city-wrap { flex: 1; min-height: 0; }
      .trail { top: 10px; left: 10px; max-width: 84%; }
      .trail-chip { font-size: 10px; padding: 3px 9px; max-width: 130px; }
      .drive-status { bottom: 16px; font-size: 11.5px; max-width: 92%; }

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
        box-shadow: 0 -8px 40px rgba(80,55,25,0.25);
      }
      .side-panel.open { animation: sheetSlide 0.3s ease-out; }
      @keyframes sheetSlide { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
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

      .legend { gap: 8px; padding: 6px 8px; flex-wrap: wrap; }
      .legend-filters { gap: 9px; flex-wrap: wrap; justify-content: center; }
      .legend-item { font-size: 9px; }
      .legend-dot { width: 6px; height: 6px; }
      .era-strip { padding: 0 8px; }
      .era-seg { width: 11px; height: 8px; }
      .empty-hint { bottom: 16px; font-size: 11px; width: max-content; max-width: 92%; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-brand">
      <h1>Lịch Sử Việt Nam</h1>
      <span class="subtitle">Phố cổ tri thức · 3D</span>
      <a class="view-link" href="index.html">Bản đồ tinh tú ↗</a>
    </div>
    <div class="controls">
      <span class="node-count"><strong id="nodeCount">0</strong> ngôi nhà &middot; <strong id="edgeCount">0</strong> liên kết</span>
      <div class="search-wrap">
        <input type="text" id="searchBox" placeholder="Tìm nhân vật, triều đại, sự kiện…" autocomplete="off">
        <div class="search-results" id="searchResults"></div>
      </div>
    </div>
  </div>

  <div class="main">
    <div class="city-wrap">
      <div class="city-container" id="city"></div>
      <div class="trail" id="trail"></div>
      <div class="empty-hint" id="hint">Lái xe dọc đại lộ thời gian — đến gần một ngôi nhà, tên sẽ hiện lên</div>
      <div class="drive-status" id="driveStatus">
        <span>Đang tới <b id="driveTarget"></b>…</span>
        <button class="skip-btn" id="skipBtn">Đến ngay ↦</button>
      </div>
      <div class="drive-hud" id="driveHud">
        <div><b>W</b>/<b>↑</b> tiến &nbsp; <b>S</b>/<b>↓</b> lùi &nbsp; <b>A D</b>/<b>←→</b> rẽ &nbsp; <b>Shift</b> tăng tốc</div>
        <div><b>E</b> xem nhà &nbsp; <b>M</b> toàn cảnh &nbsp; <b>H</b> nổi bật &nbsp; <b>Esc</b> tạm dừng</div>
      </div>
      <div class="hl-panel" id="hlPanel">
        <div class="hl-title">Điểm nổi bật — nhấn số để tới</div>
        <div id="hlList"></div>
      </div>
      <div class="pause-overlay" id="pauseOverlay">
        <div class="pause-card">
          <div class="pause-rows" id="pauseRows"></div>
          <div class="pause-foot">Tạm dừng — nhấn phím bất kỳ hoặc chạm để tiếp tục</div>
        </div>
      </div>
      <button class="near-prompt" id="nearPrompt"><span class="key">E</span> Xem&nbsp;<b id="nearTitle"></b></button>
      <div class="district-chip" id="districtChip"></div>
      <div class="joystick" id="joystick"><div class="joy-knob" id="joyKnob"></div></div>
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
    <div class="era-strip" id="eraStrip" title="Các khu phố theo thời kỳ"></div>
    <button class="overview-btn" id="overviewBtn">Toàn cảnh</button>
  </div>

  <script type="module">
    import * as THREE from 'three';
    import SpriteText from 'three-spritetext';
    import { MapControls } from 'three/addons/controls/MapControls.js';

    const WIKI_DATA = ${jsonData};
    const CITY = ${jsonLayout};

    const TYPE_COLORS = {
      person: '#d9b25a', concept: '#b9c2a6', dynasty: '#c4452a',
      event: '#cf7a3f', place: '#6f9a86', era: '#5d7aa0'
    };
    const TYPE_LABELS = {
      person: 'Nhân vật', concept: 'Văn hóa', dynasty: 'Triều đại',
      event: 'Sự kiện', place: 'Địa danh', era: 'Thời kỳ'
    };

    // scene tokens — Phố cổ ban ngày (Peregrino daylight recipe)
    const COL_ROAD = 0xb3a58c;                        // sun-warmed stone
    const COL_FOG = 0xcfdfe8;                         // pale morning haze
    const COL_WINDOW = new THREE.Color('#ffd773');    // warm glow for the selected house
    const COL_GLASS = new THREE.Color('#5a6d7c');     // daylight window glass w/ sky reflection

    document.getElementById('nodeCount').textContent = WIKI_DATA.nodes.length;
    document.getElementById('edgeCount').textContent = WIKI_DATA.edges.length;

    const container = document.getElementById('city');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    function hasWebGL() {
      try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
      } catch (e) { return false; }
    }
    if (!hasWebGL()) {
      container.innerHTML = '<div class="webgl-fallback">'
        + '<h2>Trình duyệt chưa hỗ trợ WebGL</h2>'
        + '<p>Phố cổ tri thức 3D cần WebGL để hiển thị. Hãy thử bật tăng tốc phần cứng hoặc dùng trình duyệt khác (Chrome, Firefox, Safari, Edge).</p>'
        + '</div>';
    } else {
      buildCity();
    }

    function resolveNodeId(title) {
      return title.toLowerCase().replace(/\\s+/g, '-');
    }
    function normalize(s) {
      return s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/đ/g, 'd');
    }
    // same FNV-1a as the build-time layout — deterministic lit windows
    function hash01(id) {
      let h = 0x811c9dc5;
      for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return (h >>> 0) / 0x100000000;
    }
    function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function buildCity() {
      // ── data prep ──
      const nodeById = new Map(WIKI_DATA.nodes.map(n => [n.id, n]));
      const deg = {};
      const neighborsOf = {};
      const seenPair = new Set();
      WIKI_DATA.nodes.forEach(n => { deg[n.id] = 0; neighborsOf[n.id] = []; });
      WIKI_DATA.edges.forEach(e => {
        const key = e.source < e.target ? e.source + '|' + e.target : e.target + '|' + e.source;
        if (seenPair.has(key)) return;
        seenPair.add(key);
        deg[e.source] = (deg[e.source] || 0) + 1;
        deg[e.target] = (deg[e.target] || 0) + 1;
        if (neighborsOf[e.source]) neighborsOf[e.source].push(e.target);
        if (neighborsOf[e.target]) neighborsOf[e.target].push(e.source);
      });

      const buildings = CITY.buildings;
      const buildingById = new Map(buildings.map(b => [b.id, b]));
      const idxById = new Map(buildings.map((b, i) => [b.id, i]));
      const districtByEra = new Map(CITY.districts.map(d => [d.era, d]));

      // ── renderer / scene / camera ──
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xe2ebf0);
      const fog = new THREE.FogExp2(COL_FOG, 0.0018);
      scene.fog = fog;

      const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 4000);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      const enableShadows = !isMobile;
      if (enableShadows) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      container.appendChild(renderer.domElement);

      function resize() {
        const w = container.clientWidth, h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
      window.addEventListener('resize', resize);
      resize();

      // ── lights: mid-morning sun over the old town ──
      scene.add(new THREE.HemisphereLight(0xc8dcea, 0x6a7a5c, 1.3));
      const sun = new THREE.DirectionalLight(0xfff2dc, 1.2);
      sun.position.set(70, 110, 45);
      if (enableShadows) {
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -130;
        sun.shadow.camera.right = 130;
        sun.shadow.camera.top = 130;
        sun.shadow.camera.bottom = -130;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 400;
        sun.shadow.bias = -0.0006;
      }
      scene.add(sun);
      scene.add(sun.target);

      // ── procedural canvas textures (Peregrino-style: no external assets) ──
      function canvasTex(size, draw, repeatX, repeatY) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        draw(cv.getContext('2d'), size);
        const t = new THREE.CanvasTexture(cv);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        if (repeatX) t.repeat.set(repeatX, repeatY || repeatX);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      }
      // tile rows on a neutral warm base — the per-instance TYPE color supplies the hue
      const roofTex = canvasTex(128, (ctx, s) => {
        ctx.fillStyle = '#b0a294';
        ctx.fillRect(0, 0, s, s);
        for (let y = 0; y < s; y += 10) {
          ctx.fillStyle = 'rgba(60,24,12,0.5)';
          ctx.fillRect(0, y, s, 2.5);
          const off = (y / 10) % 2 ? 8 : 0;
          for (let x = -8; x < s; x += 16) {
            ctx.fillStyle = 'rgba(50,20,10,0.28)';
            ctx.fillRect(x + off, y + 2, 1.6, 8);
          }
        }
        for (let i = 0; i < 220; i++) {
          ctx.fillStyle = 'rgba(255,190,130,' + (Math.random() * 0.06) + ')';
          ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
        }
        // baked shading: eaves darker, ridge catches the light (v=0 is canvas bottom)
        const shade = ctx.createLinearGradient(0, s, 0, 0);
        shade.addColorStop(0, 'rgba(0,0,0,0.24)');
        shade.addColorStop(1, 'rgba(255,235,200,0.2)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, s, s);
      }, 2, 2);
      // aged plaster wall — noise streaks over cream, tinted per type
      const wallTex = canvasTex(128, (ctx, s) => {
        ctx.fillStyle = '#cfc0a4';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 500; i++) {
          const g = 150 + Math.random() * 90;
          ctx.fillStyle = 'rgba(' + g + ',' + (g * 0.9 | 0) + ',' + (g * 0.72 | 0) + ',0.16)';
          ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 5, 6 + Math.random() * 16);
        }
        ctx.fillStyle = 'rgba(70,50,30,0.25)';
        ctx.fillRect(0, s - 7, s, 7); // damp base line
      });
      // sunlit grass (Peregrino: #9aa882 base + blobs + strokes)
      const groundTex = canvasTex(256, (ctx, s) => {
        ctx.fillStyle = '#9aa882';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 160; i++) {
          const v = Math.random();
          ctx.fillStyle = 'rgba(' + (95 + v * 50 | 0) + ',' + (125 + v * 45 | 0) + ',' + (70 + v * 35 | 0) + ',0.35)';
          ctx.beginPath();
          ctx.arc(Math.random() * s, Math.random() * s, 3 + Math.random() * 9, 0, 7);
          ctx.fill();
        }
        for (let i = 0; i < 900; i++) {
          ctx.strokeStyle = 'rgba(' + (70 + Math.random() * 40 | 0) + ',' + (100 + Math.random() * 40 | 0) + ',60,0.3)';
          const x = Math.random() * s, y = Math.random() * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.random() * 3 - 1.5, y - 2 - Math.random() * 3);
          ctx.stroke();
        }
      }, 200, 200);

      // hipped roof: unit base 1×1, ridge along x at y=1 (non-indexed → flat shading)
      function makeHipRoofGeo() {
        const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], C = [0.5, 0, 0.5], D = [-0.5, 0, 0.5];
        const R1 = [-0.26, 1, 0], R2 = [0.26, 1, 0];
        const tris = [
          D, C, R2, D, R2, R1, // front slope
          B, A, R1, B, R1, R2, // back slope
          A, D, R1,            // west hip
          C, B, R2             // east hip
        ];
        const pos = [];
        tris.forEach(v => pos.push(v[0], v[1], v[2]));
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const uv = [];
        for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] + 0.5, pos[i + 1]);
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.computeVertexNormals();
        return geo;
      }
      const hipRoofGeo = makeHipRoofGeo();

      // ── sky: pale morning gradient dome + drifting clouds (Peregrino recipe) ──
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x8db8d4) },
          horizon: { value: new THREE.Color(0xe2ebf0) }
        },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 horizon;'
          + ' void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.12, 0.0, 1.0);'
          + ' gl_FragColor = vec4(mix(horizon, top, pow(h, 0.75)), 1.0); }'
      });
      const sky = new THREE.Mesh(new THREE.SphereGeometry(2600, 24, 14), skyMat);
      sky.position.set(0, 0, (CITY.bounds.minZ + CITY.bounds.maxZ) / 2);
      scene.add(sky);

      const cloudTex = canvasTex(256, (ctx, s) => {
        for (let i = 0; i < 22; i++) {
          const x = Math.random() * s, y = s * 0.3 + Math.random() * s * 0.4;
          const r = 20 + Math.random() * 46;
          const g = ctx.createRadialGradient(x, y, 2, x, y, r);
          g.addColorStop(0, 'rgba(248,250,252,0.5)');
          g.addColorStop(1, 'rgba(248,250,252,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, s, s);
        }
      });
      const clouds = [];
      const cityMidZ = (CITY.bounds.minZ + CITY.bounds.maxZ) / 2;
      for (let i = 0; i < 9; i++) {
        const mat = new THREE.SpriteMaterial({
          map: cloudTex, transparent: true, opacity: 0.4 + hash01('co:' + i) * 0.25,
          depthWrite: false, fog: false
        });
        const sp = new THREE.Sprite(mat);
        const a = hash01('ca:' + i) * Math.PI * 2;
        const r = 220 + hash01('crr:' + i) * 480;
        sp.position.set(Math.cos(a) * r, 170 + hash01('cy:' + i) * 130, cityMidZ + Math.sin(a) * r);
        const cw = 140 + hash01('cs:' + i) * 190;
        sp.scale.set(cw, cw * 0.42, 1);
        sp.userData.speed = 1.0 + hash01('cv:' + i) * 1.6;
        scene.add(sp);
        clouds.push(sp);
      }

      // ── ground ──
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(6000, 6000),
        new THREE.MeshLambertMaterial({ color: 0xb6bc98, map: groundTex })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = enableShadows;
      scene.add(ground);

      // ── roads: merged quads ──
      const roadPos = [];
      function addRoadQuad(a, b, width) {
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        const nx = (-dz / len) * width / 2, nz = (dx / len) * width / 2;
        const y = 0.02;
        // two triangles
        roadPos.push(
          a.x - nx, y, a.z - nz,  b.x - nx, y, b.z - nz,  b.x + nx, y, b.z + nz,
          a.x - nx, y, a.z - nz,  b.x + nx, y, b.z + nz,  a.x + nx, y, a.z + nz
        );
      }
      CITY.roads.edges.forEach(e => {
        const a = CITY.roads.nodes[e.a].p, b = CITY.roads.nodes[e.b].p;
        addRoadQuad(a, b, e.kind === 'avenue' ? 10 : 4.2);
      });
      const roadGeo = new THREE.BufferGeometry();
      roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
      roadGeo.computeVertexNormals();
      const roadMesh = new THREE.Mesh(roadGeo, new THREE.MeshLambertMaterial({ color: COL_ROAD }));
      roadMesh.receiveShadow = enableShadows;
      scene.add(roadMesh);

      // gold avenue edge lines
      const edgeLinePos = [];
      const zMin = CITY.bounds.minZ - 6, zMax = CITY.bounds.maxZ + 6;
      [-4.7, 4.7].forEach(x => { edgeLinePos.push(x, 0.06, zMin, x, 0.06, zMax); });
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeLinePos, 3));
      scene.add(new THREE.LineSegments(edgeGeo,
        new THREE.LineBasicMaterial({ color: 0xf4f6f2, transparent: true, opacity: 0.6 })));

      // ── buildings: textured walls + eaves trim + hipped tile roofs + columns ──
      const N = buildings.length;
      const dummy = new THREE.Object3D();
      const mLocal = new THREE.Matrix4();
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      const TIERED = new Set(['dynasty', 'concept', 'era']); // đình / chùa / tháp silhouettes

      const wallMesh = new THREE.InstancedMesh(boxGeo,
        new THREE.MeshLambertMaterial({ map: wallTex }), N);
      const roofMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial(), N); // eaves trim — carries the type color
      const wallBase = [];
      const roofBase = [];

      // hipped roofs: one instance per building + one extra tier for TIERED types
      const tierOwners = [];
      buildings.forEach(b => {
        const node = nodeById.get(b.id);
        if (node && TIERED.has(node.type)) tierOwners.push(idxById.get(b.id));
      });
      // unlit + baked shading: keeps the color-coded roofscape readable at night
      const hipMesh = new THREE.InstancedMesh(hipRoofGeo,
        new THREE.MeshBasicMaterial({ map: roofTex }), N + tierOwners.length);
      const hipBase = [];
      const roofHof = [];

      buildings.forEach((b, i) => {
        dummy.position.set(b.position.x, b.height / 2, b.position.z);
        dummy.rotation.set(0, b.rotationY, 0);
        dummy.scale.set(b.width, b.height, b.depth);
        dummy.updateMatrix();
        wallMesh.setMatrixAt(i, dummy.matrix);

        // eaves board just under the roof
        dummy.position.y = b.height + 0.1;
        dummy.scale.set(b.width * 1.28, 0.22, b.depth * 1.28);
        dummy.updateMatrix();
        roofMesh.setMatrixAt(i, dummy.matrix);

        // hipped tile roof
        const roofH = 1.7 + b.height * 0.14;
        roofHof.push(roofH);
        dummy.position.y = b.height + 0.18;
        dummy.scale.set(b.width * 1.34, roofH, b.depth * 1.34);
        dummy.updateMatrix();
        hipMesh.setMatrixAt(i, dummy.matrix);

        const node = nodeById.get(b.id);
        const type = node ? node.type : 'unknown';
        const typeCol = new THREE.Color(TYPE_COLORS[type] || '#888888');
        // sun-bleached plaster with a whisper of the type color — roofs carry the hue
        const wall = typeCol.clone().lerp(new THREE.Color('#eee2c8'), 0.7);
        const roof = typeCol.clone().multiplyScalar(0.95);
        // neutral tile texture × type color = color-coded roofscape from above
        const hip = typeCol.clone().lerp(new THREE.Color('#c08a5a'), 0.12).multiplyScalar(1.1);
        wallBase.push(wall);
        roofBase.push(roof);
        hipBase.push(hip);
        wallMesh.setColorAt(i, wall);
        roofMesh.setColorAt(i, roof);
        hipMesh.setColorAt(i, hip);
      });
      // upper tiers (đình/chùa): smaller roof floating above the main one
      tierOwners.forEach((bi, k) => {
        const b = buildings[bi];
        const roofH = roofHof[bi];
        dummy.position.set(b.position.x, b.height + 0.18 + roofH + 0.55, b.position.z);
        dummy.rotation.set(0, b.rotationY, 0);
        dummy.scale.set(b.width * 0.78, roofH * 0.66, b.depth * 0.78);
        dummy.updateMatrix();
        hipMesh.setMatrixAt(N + k, dummy.matrix);
        hipMesh.setColorAt(N + k, hipBase[bi]);
      });
      wallMesh.castShadow = wallMesh.receiveShadow = enableShadows;
      roofMesh.castShadow = enableShadows;
      hipMesh.castShadow = enableShadows;
      scene.add(wallMesh);
      scene.add(roofMesh);
      scene.add(hipMesh);

      // porch columns for dynasty halls (đình)
      const colOwners = buildings.filter(b => {
        const n = nodeById.get(b.id);
        return n && n.type === 'dynasty';
      });
      const colGeo = new THREE.CylinderGeometry(0.15, 0.18, 1, 6);
      const colMesh = new THREE.InstancedMesh(colGeo,
        new THREE.MeshLambertMaterial({ color: 0x4a3524 }), colOwners.length * 4);
      colOwners.forEach((b, k) => {
        dummy.position.set(b.position.x, 0, b.position.z);
        dummy.rotation.set(0, b.rotationY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        const colH = Math.min(3.2, b.height * 0.7);
        [-0.36, -0.13, 0.13, 0.36].forEach((fx, j) => {
          mLocal.makeTranslation(fx * b.width, colH / 2, b.depth / 2 + 0.75);
          const m = dummy.matrix.clone().multiply(mLocal)
            .multiply(new THREE.Matrix4().makeScale(1, colH, 1));
          colMesh.setMatrixAt(k * 4 + j, m);
        });
      });
      scene.add(colMesh);

      // windows — one instanced quad mesh, lit deterministically
      const winGeo = new THREE.PlaneGeometry(0.8, 1.05);
      const winOwner = [];   // window index -> building index
      const winLit = [];     // window index -> lit at rest?
      const winMatrices = [];
      buildings.forEach((b, bi) => {
        const floors = Math.max(1, Math.floor((b.height - 1.4) / 2.2));
        const cols = b.width >= 6.4 ? 3 : 2;
        dummy.position.set(b.position.x, 0, b.position.z);
        dummy.rotation.set(0, b.rotationY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < cols; c++) {
            const lx = ((c + 1) / (cols + 1) - 0.5) * b.width;
            const ly = 1.35 + f * 2.2;
            const lz = b.depth / 2 + 0.04;
            mLocal.makeTranslation(lx, ly, lz);
            winMatrices.push(dummy.matrix.clone().multiply(mLocal));
            winOwner.push(bi);
            winLit.push(hash01(b.id + ':w' + f + ':' + c) > 0.3);
          }
        }
      });
      const winMesh = new THREE.InstancedMesh(
        winGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), winMatrices.length);
      winMatrices.forEach((m, i) => winMesh.setMatrixAt(i, m));
      scene.add(winMesh);

      // ── district gates + banner labels ──
      const banners = [];
      const gateCount = CITY.districts.length;
      const gateMesh = new THREE.InstancedMesh(boxGeo,
        new THREE.MeshLambertMaterial({ color: 0x6b5232 }), gateCount * 3);
      CITY.districts.forEach((d, i) => {
        [-9, 9].forEach((x, k) => {
          dummy.position.set(x, 4.5, d.gate.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(0.7, 9, 0.7);
          dummy.updateMatrix();
          gateMesh.setMatrixAt(i * 3 + k, dummy.matrix);
        });
        dummy.position.set(0, 8.9, d.gate.z);
        dummy.scale.set(19.2, 0.55, 0.8);
        dummy.updateMatrix();
        gateMesh.setMatrixAt(i * 3 + 2, dummy.matrix);

        const banner = new SpriteText(d.label);
        banner.color = '#6e4a0e';
        banner.textHeight = 3.4;
        banner.fontFace = 'Newsreader, Georgia, serif';
        banner.fontWeight = '700';
        banner.material.depthWrite = false;
        banner.position.set(0, 11.6, d.gate.z);
        banner.__baseScale = banner.scale.clone();
        scene.add(banner);
        banners.push(banner);
      });
      scene.add(gateMesh);

      // glow texture (car lights, selection halo)
      const lanternTex = (() => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 64;
        const ctx = cv.getContext('2d');
        const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
        g.addColorStop(0, 'rgba(255,240,200,1)');
        g.addColorStop(0.35, 'rgba(255,220,150,0.55)');
        g.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(cv);
      })();

      // ── trees: instanced trunks + canopies in the district gaps and behind back lanes ──
      const treeSpots = [];
      CITY.districts.forEach((d, i) => {
        // grove in the dark gap after each district
        for (let k = 0; k < 7; k++) {
          const h = hash01(d.era + ':tree:' + k);
          const x = (h - 0.5) * (d.bounds.maxX - d.bounds.minX + 30);
          if (Math.abs(x) < 7) continue; // keep the avenue clear
          treeSpots.push([x, d.zEnd + 2 + hash01(d.era + ':tz:' + k) * 5]);
        }
        // a few behind the district's outer edge
        for (let k = 0; k < 5; k++) {
          const side = k % 2 ? 1 : -1;
          const zi = d.zStart + 6 + hash01(d.era + ':bz:' + k) * (d.zEnd - d.zStart - 10);
          treeSpots.push([side * (Math.max(Math.abs(d.bounds.minX), d.bounds.maxX) + 6 + hash01(d.era + ':bx:' + k) * 10), zi]);
        }
      });
      const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 5);
      const canopyGeo = new THREE.IcosahedronGeometry(1, 0);
      const trunkMesh = new THREE.InstancedMesh(trunkGeo,
        new THREE.MeshLambertMaterial({ color: 0x33241a }), treeSpots.length);
      const canopyMesh = new THREE.InstancedMesh(canopyGeo,
        new THREE.MeshLambertMaterial({ color: 0x24402a }), treeSpots.length);
      const canopyTint = new THREE.Color();
      treeSpots.forEach(([x, z], i) => {
        const th = 2.2 + hash01('th:' + i) * 2.6;
        dummy.position.set(x, th / 2, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, th, 1);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);
        const cr = 1.4 + hash01('cr:' + i) * 1.5;
        dummy.position.set(x, th + cr * 0.55, z);
        dummy.scale.set(cr, cr * 1.15, cr);
        dummy.updateMatrix();
        canopyMesh.setMatrixAt(i, dummy.matrix);
        canopyTint.setHSL(0.28 + hash01('ch:' + i) * 0.08, 0.42, 0.3 + hash01('cl:' + i) * 0.1);
        canopyMesh.setColorAt(i, canopyTint);
      });
      trunkMesh.castShadow = canopyMesh.castShadow = enableShadows;
      scene.add(trunkMesh);
      scene.add(canopyMesh);

      // ── car: procedural low-poly with cabin, spinning wheels, lights ──
      const car = new THREE.Group();
      const carPaint = new THREE.MeshLambertMaterial({ color: 0xc4452a });
      const carDark = new THREE.MeshLambertMaterial({ color: 0x1c130c });
      const carGlass = new THREE.MeshLambertMaterial({ color: 0x27333d });
      // chassis + hood step
      const carBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 3.1), carPaint);
      carBody.position.y = 0.62;
      const carHood = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.9), carPaint);
      carHood.position.set(0, 0.98, 1.0);
      // cabin with glass sides
      const carCabin = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.62, 1.6), carGlass);
      carCabin.position.set(0, 1.2, -0.25);
      const carTop = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.1, 1.7), carPaint);
      carTop.position.set(0, 1.54, -0.25);
      // bumpers
      const carBumper = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.18, 3.25), carDark);
      carBumper.position.y = 0.38;
      car.add(carBody, carHood, carCabin, carTop, carBumper);
      // wheels — rotated cylinders that spin with travel
      const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheels = [];
      [[-0.78, 1.05], [0.78, 1.05], [-0.78, -1.05], [0.78, -1.05]].forEach(([x, z]) => {
        const w = new THREE.Mesh(wheelGeo, carDark);
        w.position.set(x, 0.34, z);
        car.add(w);
        wheels.push(w);
      });
      // headlights (warm) + taillights (red)
      const headMat = new THREE.SpriteMaterial({
        map: lanternTex, color: 0xffe9b8, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const tailMat = new THREE.SpriteMaterial({
        map: lanternTex, color: 0xff3a22, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      [-0.5, 0.5].forEach(x => {
        const h = new THREE.Sprite(headMat);
        h.scale.setScalar(1.4);
        h.position.set(x, 0.7, 1.62);
        car.add(h);
        const t = new THREE.Sprite(tailMat);
        t.scale.setScalar(0.8);
        t.position.set(x, 0.68, -1.62);
        car.add(t);
      });
      car.traverse(o => { if (o.isMesh) o.castShadow = enableShadows; });
      headMat.opacity = 0.45; // daytime headlights, just a hint
      const gate0 = CITY.districts[0] ? CITY.districts[0].gate : { x: 0, z: 0 };
      car.position.set(2.5, 0, gate0.z + 4);
      scene.add(car);

      // ── link arcs (lantern strings) ──
      let arcLines = null;
      function clearArcs() {
        if (arcLines) { scene.remove(arcLines); arcLines.geometry.dispose(); arcLines = null; }
      }
      function showArcs(node) {
        clearArcs();
        const from = buildingById.get(node.id);
        if (!from) return;
        const pts = [];
        const SEG = 14;
        const neighbors = Array.from(new Set(neighborsOf[node.id] || [])).slice(0, 40);
        neighbors.forEach(nid => {
          const to = buildingById.get(nid);
          if (!to) return;
          const a = new THREE.Vector3(from.position.x, from.height + (1.7 + from.height * 0.14) + 0.6, from.position.z);
          const c = new THREE.Vector3(to.position.x, to.height + (1.7 + to.height * 0.14) + 0.6, to.position.z);
          const dist = a.distanceTo(c);
          const mid = a.clone().add(c).multiplyScalar(0.5);
          mid.y += Math.max(10, dist * 0.22);
          const curve = new THREE.QuadraticBezierCurve3(a, mid, c);
          const cp = curve.getPoints(SEG);
          for (let i = 0; i < cp.length - 1; i++) {
            pts.push(cp[i].x, cp[i].y, cp[i].z, cp[i + 1].x, cp[i + 1].y, cp[i + 1].z);
          }
        });
        if (!pts.length) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        // crimson silk threads — read against the pale sky
        arcLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
          color: 0xb9231e, transparent: true, opacity: 0.75, depthWrite: false
        }));
        scene.add(arcLines);
      }

      // ── highlight & filter state → instance colors ──
      const activeTypes = new Set(Object.keys(TYPE_COLORS));
      let selectedId = null;
      let highlightSet = null; // Set of building ids (selected + neighbors) or null

      const tmpColor = new THREE.Color();
      const HAZE = new THREE.Color(0xd6dfe2); // daylight dimming = fade into the morning haze
      function fadeAmount(typeOn, inHl) {
        if (!typeOn) return 0.78;
        if (!inHl) return 0.6;
        return 0;
      }
      function applyColors() {
        buildings.forEach((b, i) => {
          const node = nodeById.get(b.id);
          const typeOn = node ? activeTypes.has(node.type) : true;
          const inHl = !highlightSet || highlightSet.has(b.id);
          const fade = fadeAmount(typeOn, inHl);
          const sel = b.id === selectedId;
          wallMesh.setColorAt(i, tmpColor.copy(wallBase[i]).lerp(HAZE, fade));
          roofMesh.setColorAt(i, tmpColor.copy(roofBase[i]).lerp(HAZE, fade)
            .multiplyScalar(sel ? 1.4 : 1));
          hipMesh.setColorAt(i, tmpColor.copy(hipBase[i]).lerp(HAZE, fade)
            .multiplyScalar(sel ? 1.25 : 1));
        });
        tierOwners.forEach((bi, k) => {
          const b = buildings[bi];
          const node = nodeById.get(b.id);
          const typeOn = node ? activeTypes.has(node.type) : true;
          const inHl = !highlightSet || highlightSet.has(b.id);
          const fade = fadeAmount(typeOn, inHl);
          hipMesh.setColorAt(N + k, tmpColor.copy(hipBase[bi]).lerp(HAZE, fade)
            .multiplyScalar(b.id === selectedId ? 1.25 : 1));
        });
        wallMesh.instanceColor.needsUpdate = true;
        roofMesh.instanceColor.needsUpdate = true;
        hipMesh.instanceColor.needsUpdate = true;
        for (let w = 0; w < winOwner.length; w++) {
          const b = buildings[winOwner[w]];
          const node = nodeById.get(b.id);
          const typeOn = node ? activeTypes.has(node.type) : true;
          const inHl = !highlightSet || highlightSet.has(b.id);
          const isSel = b.id === selectedId;
          let c;
          if (isSel) c = tmpColor.copy(COL_WINDOW).multiplyScalar(1.3); // the visited house lights up
          else if (highlightSet && inHl && typeOn) c = tmpColor.copy(COL_WINDOW).multiplyScalar(0.85);
          else {
            // daylight glass — subtle sky-reflection variation
            c = tmpColor.copy(COL_GLASS).multiplyScalar(winLit[w] ? 1.18 : 0.85);
            if (!typeOn) c.lerp(HAZE, 0.7);
            else if (highlightSet && !inHl) c.lerp(HAZE, 0.5);
          }
          winMesh.setColorAt(w, c);
        }
        winMesh.instanceColor.needsUpdate = true;
      }
      applyColors();

      // ── building labels: lazy sprites with distance LOD ──
      const labelOf = new Array(N).fill(null);
      const LABEL_NEAR = isMobile ? 55 : 95;
      let labelTick = 0;
      let hoverIdx = -1;
      function ensureLabel(i) {
        if (labelOf[i]) return labelOf[i];
        const b = buildings[i];
        const node = nodeById.get(b.id);
        const s = new SpriteText(node ? node.title : b.id);
        s.color = '#2b241a';
        s.backgroundColor = 'rgba(250,246,236,0.72)';
        s.padding = 1.5;
        s.borderRadius = 3;
        s.textHeight = 2.2;
        s.fontFace = 'Be Vietnam Pro, sans-serif';
        s.fontWeight = '500';
        s.material.depthWrite = false;
        s.position.set(b.position.x, b.height + (1.7 + b.height * 0.14) + 2.4, b.position.z);
        s.visible = false;
        s.__baseScale = s.scale.clone();
        scene.add(s);
        labelOf[i] = s;
        return s;
      }
      const MAX_LABELS = isMobile ? 4 : 6;
      function updateLabels(force) {
        const now = performance.now();
        if (!force && now - labelTick < 120) return;
        labelTick = now;
        const cam = camera.position;
        // adaptive morning haze: dense at street level, thin from the air (Peregrino)
        const viewDist = cam.distanceTo(controls.target);
        fog.density = 0.95 / Math.max(240, viewDist * 2.2);

        // labels blow up when the camera is almost on top of them — fade them out
        const nearFade = d => Math.max(0, Math.min(1, (d - 8) / 8));

        // pass 1: collect candidates, keep only the nearest MAX_LABELS non-forced
        const candidates = [];
        for (let i = 0; i < N; i++) {
          const b = buildings[i];
          const d = Math.hypot(cam.x - b.position.x, cam.y - (b.height + 2), cam.z - b.position.z);
          const forced = (highlightSet && highlightSet.has(b.id)) || i === hoverIdx;
          if (forced || d < LABEL_NEAR) candidates.push({ i, d, forced });
          else if (labelOf[i]) labelOf[i].visible = false;
        }
        const nearOnly = candidates.filter(c => !c.forced).sort((a, b) => a.d - b.d);
        const allowed = new Set(nearOnly.slice(0, MAX_LABELS).map(c => c.i));
        // forced (selection neighborhood) also capped — nearest few, selected always
        const selIdx = selectedId ? idxById.get(selectedId) : -1;
        const forcedNear = candidates.filter(c => c.forced && c.i !== selIdx)
          .sort((a, b) => a.d - b.d).slice(0, 9);
        const allowedForced = new Set(forcedNear.map(c => c.i));
        if (selIdx !== -1) allowedForced.add(selIdx);
        for (const c of candidates) {
          if ((c.forced && !allowedForced.has(c.i)) || (!c.forced && !allowed.has(c.i))) {
            if (labelOf[c.i]) labelOf[c.i].visible = false;
            continue;
          }
          const s = ensureLabel(c.i);
          const base = c.forced ? 0.98 : Math.min(1, (LABEL_NEAR - c.d) / 50) * 0.88;
          const o = base * nearFade(c.d);
          s.visible = o > 0.04;
          s.material.opacity = o;
          // quasi-constant screen size: scale with distance instead of fixed world size
          const k = Math.min(1.8, Math.max(0.5, c.d / 60));
          s.scale.copy(s.__baseScale).multiplyScalar(k);
        }

        // district banners: near-fade + distance scaling so gates read at any zoom
        for (const bn of banners) {
          const d = cam.distanceTo(bn.position);
          bn.material.opacity = 0.95 * Math.max(0, Math.min(1, (d - 12) / 12));
          bn.visible = bn.material.opacity > 0.04;
          const k = Math.min(3, Math.max(0.6, d / 70));
          bn.scale.copy(bn.__baseScale).multiplyScalar(k);
        }
      }

      // ── controls ──
      const controls = new MapControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = 1.45;
      controls.minDistance = 12;
      controls.maxDistance = 900;
      controls.addEventListener('change', () => updateLabels());

      const cityCenter = new THREE.Vector3(
        (CITY.bounds.minX + CITY.bounds.maxX) / 2, 0, (CITY.bounds.minZ + CITY.bounds.maxZ) / 2);
      const cityLen = CITY.bounds.maxZ - CITY.bounds.minZ;

      function clampTarget() {
        controls.target.x = Math.max(CITY.bounds.minX - 40, Math.min(CITY.bounds.maxX + 40, controls.target.x));
        controls.target.z = Math.max(CITY.bounds.minZ - 60, Math.min(CITY.bounds.maxZ + 60, controls.target.z));
        controls.target.y = Math.max(0, Math.min(30, controls.target.y));
      }

      // ── camera tween helper ──
      let camTween = null;
      function tweenCamera(toPos, toTarget, ms, onDone) {
        if (reduceMotion || ms <= 0) {
          camera.position.copy(toPos);
          controls.target.copy(toTarget);
          updateLabels(true);
          if (onDone) onDone();
          return;
        }
        camTween = {
          p0: camera.position.clone(), p1: toPos.clone(),
          t0: controls.target.clone(), t1: toTarget.clone(),
          start: performance.now(), ms, onDone
        };
      }
      function stepTween(now) {
        if (!camTween) return;
        const t = Math.min(1, (now - camTween.start) / camTween.ms);
        const e = easeInOutCubic(t);
        camera.position.lerpVectors(camTween.p0, camTween.p1, e);
        controls.target.lerpVectors(camTween.t0, camTween.t1, e);
        if (t >= 1) {
          const done = camTween.onDone;
          camTween = null;
          updateLabels(true);
          if (done) done();
        }
      }

      // ── road graph + Dijkstra ──
      const adj = CITY.roads.nodes.map(() => []);
      CITY.roads.edges.forEach(e => {
        adj[e.a].push({ to: e.b, w: e.length });
        adj[e.b].push({ to: e.a, w: e.length });
      });
      function dijkstra(from, to) {
        const nN = adj.length;
        const dist = new Array(nN).fill(Infinity);
        const prev = new Array(nN).fill(-1);
        const done = new Array(nN).fill(false);
        dist[from] = 0;
        for (;;) {
          let u = -1, best = Infinity;
          for (let i = 0; i < nN; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
          if (u === -1 || u === to) break;
          done[u] = true;
          for (const { to: v, w } of adj[u]) {
            if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
          }
        }
        if (dist[to] === Infinity) return null;
        const path = [];
        for (let v = to; v !== -1; v = prev[v]) path.unshift(v);
        return path;
      }
      function nearestRoadNode(x, z) {
        let best = 0, bd = Infinity;
        CITY.roads.nodes.forEach(n => {
          const d = (n.p.x - x) * (n.p.x - x) + (n.p.z - z) * (n.p.z - z);
          if (d < bd) { bd = d; best = n.id; }
        });
        return best;
      }

      // ── drive machinery ──
      const CRUISE = 55; // units/second
      let drive = null;  // { curve, dur, t0, node }
      let carPortal = nearestRoadNode(car.position.x, car.position.z);
      const driveStatusEl = document.getElementById('driveStatus');
      const driveTargetEl = document.getElementById('driveTarget');

      function startDrive(node) {
        const b = buildingById.get(node.id);
        if (!b) return;
        stopIntro();
        const path = dijkstra(carPortal, b.portal);
        const pts = [car.position.clone()];
        if (path) {
          path.forEach(id => {
            const p = CITY.roads.nodes[id].p;
            pts.push(new THREE.Vector3(p.x, 0, p.z));
          });
        } else {
          const p = CITY.roads.nodes[b.portal].p;
          pts.push(new THREE.Vector3(p.x, 0, p.z));
        }
        // drop consecutive duplicates
        const clean = pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 0.5);
        carPortal = b.portal;
        if (clean.length < 2 || reduceMotion) {
          finishDrive(node, b);
          return;
        }
        const curve = new THREE.CatmullRomCurve3(clean, false, 'catmullrom', 0.15);
        const len = curve.getLength();
        const dur = Math.max(800, Math.min(4000, (len / CRUISE) * 1000));
        drive = { curve, dur, t0: performance.now(), node, b };
        controls.enabled = false;
        driveTargetEl.textContent = node.title;
        driveStatusEl.classList.add('on');
        hideHint();
      }

      function finishDrive(node, b) {
        drive = null;
        driveStatusEl.classList.remove('on');
        const p = CITY.roads.nodes[b.portal].p;
        car.position.set(p.x, 0, p.z);
        // hand the wheel back at the doorstep, facing the house
        carState.heading = Math.atan2(b.position.x - p.x, b.position.z - p.z);
        carState.speed = 0;
        car.rotation.set(0, carState.heading, 0);
        setMode('drive');
        applySelection(node);
      }

      const lastCarPos = new THREE.Vector3();
      function stepDrive(now) {
        if (!drive) return;
        const raw = Math.min(1, (now - drive.t0) / drive.dur);
        const e = easeInOutCubic(raw);
        const pos = drive.curve.getPointAt(e);
        const tan = drive.curve.getTangentAt(Math.min(0.999, e));
        // spin the wheels with distance travelled
        const travelled = lastCarPos.distanceTo(pos);
        if (travelled < 20) wheels.forEach(w => { w.rotation.x += travelled / 0.34; });
        lastCarPos.copy(pos);
        car.position.copy(pos);
        car.lookAt(pos.x + tan.x, pos.y, pos.z + tan.z);
        // chase camera
        const desired = new THREE.Vector3(
          pos.x - tan.x * 20, 11, pos.z - tan.z * 20);
        camera.position.lerp(desired, 0.09);
        controls.target.set(pos.x + tan.x * 8, 1.5, pos.z + tan.z * 8);
        if (raw >= 1) finishDrive(drive.node, drive.b);
      }

      document.getElementById('skipBtn').addEventListener('click', () => {
        if (drive) drive.t0 = -Infinity; // next frame reaches t=1
      });

      // ── drive-tour: you hold the wheel (Peregrino first-person, on four wheels) ──
      let mode = 'drive'; // 'drive' | 'aerial'
      const carState = { heading: 0, speed: 0 };
      const keys = {};
      const joy = { f: 0, r: 0 };
      const modeBtn = document.getElementById('overviewBtn');
      const nearPromptEl = document.getElementById('nearPrompt');
      const nearTitleEl = document.getElementById('nearTitle');
      const districtChipEl = document.getElementById('districtChip');

      function setMode(m) {
        mode = m;
        modeBtn.textContent = m === 'drive' ? 'Toàn cảnh (M)' : 'Lái xe (M)';
        document.getElementById('driveHud').style.display = (m === 'drive' && !isMobile) ? '' : 'none';
        document.getElementById('joystick').style.display = (m === 'drive' && isMobile) ? 'block' : 'none';
        districtChipEl.classList.toggle('on', m === 'drive');
        controls.enabled = m === 'aerial';
        if (m === 'aerial') { setPrompt(-1); overview(); }
        else camTween = null; // the chase cam owns the camera now
      }

      window.addEventListener('keydown', e => {
        if (document.activeElement === searchBox) {
          if (e.code === 'Escape') { searchBox.blur(); searchResults.classList.remove('open'); }
          return;
        }
        if (paused) { // any key resumes (Peregrino pause pattern)
          e.preventDefault();
          setPaused(false);
          return;
        }
        if (e.code === 'Escape') {
          if (searchResults.classList.contains('open')) searchResults.classList.remove('open');
          else if (document.getElementById('hlPanel').classList.contains('on')) toggleHlPanel(false);
          else if (document.getElementById('sidePanel').classList.contains('open')) closePanel();
          else setPaused(true);
          return;
        }
        keys[e.code] = true;
        if (e.code === 'KeyE' || e.code === 'Enter') openNearest();
        if (e.code === 'KeyM') setMode(mode === 'drive' ? 'aerial' : 'drive');
        if (e.code === 'KeyH') toggleHlPanel();
        if (e.code.startsWith('Digit')) {
          const k = parseInt(e.code.slice(5), 10);
          if (k >= 1 && k <= highlights.length) {
            toggleHlPanel(false);
            driveTo(nodeById.get(highlights[k - 1].id));
          }
        }
        if (e.code.startsWith('Arrow')) e.preventDefault();
        hideHint();
      });
      window.addEventListener('keyup', e => { keys[e.code] = false; });

      // building collision — conservative square footprints, axis-separated moves
      function collides(x, z) {
        for (let i = 0; i < N; i++) {
          const b = buildings[i];
          const hw = Math.max(b.width, b.depth) / 2 + 1.0;
          if (Math.abs(x - b.position.x) < hw && Math.abs(z - b.position.z) < hw) return true;
        }
        return false;
      }

      const camLook = new THREE.Vector3();
      function stepManualDrive(dt) {
        if (mode !== 'drive' || drive) return;
        let throttle = ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 0.7 : 0);
        let steer = ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
        throttle = Math.max(-1, Math.min(1, throttle + joy.f));
        steer = Math.max(-1, Math.min(1, steer + joy.r));
        const maxSpd = keys.ShiftLeft || keys.ShiftRight ? 30 : 15;
        carState.speed += (throttle * maxSpd - carState.speed) * Math.min(1, 3.5 * dt);
        if (!throttle && Math.abs(carState.speed) < 0.05) carState.speed = 0;
        if (carState.speed !== 0) {
          carState.heading += steer * 1.8 * dt * Math.sign(carState.speed)
            * Math.min(1, Math.abs(carState.speed) / 5);
          const dx = Math.sin(carState.heading) * carState.speed * dt;
          const dz = Math.cos(carState.heading) * carState.speed * dt;
          if (!collides(car.position.x + dx, car.position.z)) car.position.x += dx;
          else carState.speed *= 0.35;
          if (!collides(car.position.x, car.position.z + dz)) car.position.z += dz;
          else carState.speed *= 0.35;
          car.position.x = Math.max(CITY.bounds.minX - 30, Math.min(CITY.bounds.maxX + 30, car.position.x));
          car.position.z = Math.max(CITY.bounds.minZ - 45, Math.min(CITY.bounds.maxZ + 45, car.position.z));
          wheels.forEach(w => { w.rotation.x += (carState.speed * dt) / 0.34; });
          hideHint();
        }
        car.rotation.set(0, carState.heading, 0);
        // chase camera — swoops in smoothly even when arriving from aerial mode
        const dirX = Math.sin(carState.heading), dirZ = Math.cos(carState.heading);
        const k = 1 - Math.exp(-5 * dt);
        camera.position.lerp(camLook.set(
          car.position.x - dirX * 11.5, 5.4, car.position.z - dirZ * 11.5), k);
        controls.target.lerp(camLook.set(
          car.position.x + dirX * 7, 1.6, car.position.z + dirZ * 7), k);
        camera.lookAt(controls.target);
      }

      // passing a house: its name appears; E (or tap) opens it
      let promptIdx = -1;
      let lastProx = 0;
      function setPrompt(i) {
        if (i === promptIdx) return;
        promptIdx = i;
        hoverIdx = i; // force this house's name label
        nearPromptEl.classList.toggle('on', i !== -1);
        if (i !== -1) {
          const node = nodeById.get(buildings[i].id);
          nearTitleEl.textContent = node ? node.title : '';
        }
        updateLabels(true);
      }
      function updateProximity(now) {
        if (now - lastProx < 150) return;
        lastProx = now;
        if (mode !== 'drive' || drive) { setPrompt(-1); return; }
        let best = -1, bd = 22 * 22;
        for (let i = 0; i < N; i++) {
          const b = buildings[i];
          const d2 = (b.position.x - car.position.x) ** 2 + (b.position.z - car.position.z) ** 2;
          if (d2 < bd) { bd = d2; best = i; }
        }
        setPrompt(best);
      }
      function openNearest() {
        if (promptIdx === -1 || mode !== 'drive') return;
        const node = nodeById.get(buildings[promptIdx].id);
        if (node) applySelection(node);
      }
      nearPromptEl.addEventListener('click', openNearest);

      // mobile: virtual joystick (left thumb) — Peregrino pattern
      const joyEl = document.getElementById('joystick');
      const knobEl = document.getElementById('joyKnob');
      let joyPointer = null;
      joyEl.addEventListener('pointerdown', e => {
        joyPointer = e.pointerId;
        joyEl.setPointerCapture(e.pointerId);
        hideHint();
      });
      joyEl.addEventListener('pointermove', e => {
        if (e.pointerId !== joyPointer) return;
        const r = joyEl.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        joy.r = Math.max(-1, Math.min(1, dx / 42));
        joy.f = Math.max(-1, Math.min(1, -dy / 42));
        knobEl.style.transform = 'translate(calc(-50% + ' + (joy.r * 30) + 'px), calc(-50% + ' + (-joy.f * 30) + 'px))';
      });
      const joyEnd = e => {
        if (e.pointerId !== joyPointer) return;
        joyPointer = null;
        joy.f = 0; joy.r = 0;
        knobEl.style.transform = 'translate(-50%, -50%)';
      };
      joyEl.addEventListener('pointerup', joyEnd);
      joyEl.addEventListener('pointercancel', joyEnd);

      // ── highlights (H): the city's landmarks — one per era, best-connected first ──
      const highlights = [];
      {
        const byDeg = [...WIKI_DATA.nodes].sort((a, b) => (deg[b.id] || 0) - (deg[a.id] || 0));
        const seenEra = new Set();
        for (const n of byDeg) {
          if (highlights.length >= 8) break;
          if (seenEra.has(n.era)) continue;
          seenEra.add(n.era);
          highlights.push(n);
        }
        for (const n of byDeg) {
          if (highlights.length >= 8) break;
          if (!highlights.includes(n)) highlights.push(n);
        }
        highlights.sort((a, b) => {
          const da = districtByEra.get(a.era), db = districtByEra.get(b.era);
          return (da ? da.index : 99) - (db ? db.index : 99);
        });
      }
      const hlPanel = document.getElementById('hlPanel');
      const hlList = document.getElementById('hlList');
      highlights.forEach((n, i) => {
        const item = document.createElement('button');
        item.className = 'hl-item';
        const d = districtByEra.get(n.era);
        item.innerHTML = '<span class="num">' + (i + 1) + '</span>'
          + '<span class="dot" style="background:' + (TYPE_COLORS[n.type] || '#888') + '"></span>'
          + n.title + '<span class="era">' + (d ? d.label : n.era) + '</span>';
        item.addEventListener('click', () => {
          toggleHlPanel(false);
          driveTo(nodeById.get(n.id));
        });
        hlList.appendChild(item);
      });
      function toggleHlPanel(force) {
        hlPanel.classList.toggle('on', force !== undefined ? force : !hlPanel.classList.contains('on'));
      }

      // ── pause overlay (Esc) — Peregrino's controls menu ──
      let paused = false;
      const pauseOverlay = document.getElementById('pauseOverlay');
      const pauseRows = document.getElementById('pauseRows');
      const ROWS = isMobile
        ? [['Cần trái', 'Lái xe'], ['Chạm nhà', 'Tự lái tới nơi'], ['Nút Xem', 'Mở bài viết'],
           ['Toàn cảnh', 'Chế độ bản đồ'], ['Dải màu dưới', 'Nhảy tới thời kỳ']]
        : [['W A S D / ↑ ↓', 'Lái xe'], ['← →', 'Rẽ'], ['Shift', 'Tăng tốc'],
           ['E / Click', 'Xem di tích'], ['M', 'Toàn cảnh'], ['H', 'Điểm nổi bật'],
           ['1–' + highlights.length, 'Đến điểm nổi bật'], ['Esc', 'Tạm dừng']];
      ROWS.forEach(([k, label]) => {
        const row = document.createElement('div');
        row.className = 'pause-row';
        row.innerHTML = '<b>' + k + '</b> ' + label;
        pauseRows.appendChild(row);
      });
      function setPaused(p) {
        paused = p;
        pauseOverlay.classList.toggle('on', p);
      }
      pauseOverlay.addEventListener('pointerdown', () => setPaused(false));
      setPaused(true); // open like Peregrino: the controls ARE the intro

      // ── selection ──
      function applySelection(node) {
        selectedId = node.id;
        highlightSet = new Set([node.id, ...(neighborsOf[node.id] || [])]);
        applyColors();
        showArcs(node);
        showPage(node);
        addToTrail(node);
        updateLabels(true);
      }
      function clearSelection() {
        selectedId = null;
        highlightSet = null;
        clearArcs();
        applyColors();
        renderTrail();
        updateLabels(true);
      }

      function driveTo(node) {
        if (!node) return;
        if (!activeTypes.has(node.type)) { activeTypes.add(node.type); syncLegend(); }
        startDrive(node);
      }
      window.navigateTo = function (targetId) {
        const target = nodeById.get(targetId);
        if (target) driveTo(target);
      };

      // ── picking ──
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downPos = null;
      renderer.domElement.addEventListener('pointerdown', e => {
        downPos = { x: e.clientX, y: e.clientY };
        hideHint();
        stopIntro();
      });
      renderer.domElement.addEventListener('pointerup', e => {
        if (!downPos) return;
        const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
        downPos = null;
        if (moved > 6 || drive) return;
        const idx = pick(e);
        if (idx !== -1) {
          const node = nodeById.get(buildings[idx].id);
          if (node) driveTo(node);
        }
      });
      if (!isMobile) {
        renderer.domElement.addEventListener('pointermove', e => {
          if (mode !== 'aerial' || drive || camTween) return;
          const idx = pick(e);
          if (idx !== hoverIdx) {
            hoverIdx = idx;
            renderer.domElement.style.cursor = idx === -1 ? 'grab' : 'pointer';
            updateLabels(true);
          }
        });
      }
      function pick(e) {
        const r = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(wallMesh, false)[0];
        return hit && hit.instanceId !== undefined ? hit.instanceId : -1;
      }

      // ── panel / related / trail (shared patterns with the graph page) ──
      function showPage(d) {
        const panel = document.getElementById('sidePanel');
        document.getElementById('pageTitle').textContent = d.title;
        const badge = document.getElementById('typeBadge');
        badge.textContent = TYPE_LABELS[d.type] || d.type;
        badge.style.background = TYPE_COLORS[d.type] || '#888';
        const district = districtByEra.get(d.era);
        document.getElementById('eraLabel').textContent = district ? district.label : d.era;
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
        requestAnimationFrame(resize);
      }

      function renderRelated(d) {
        const wrap = document.getElementById('relatedWrap');
        const box = document.getElementById('relatedChips');
        box.innerHTML = '';
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
          c.addEventListener('click', () => driveTo(n));
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

      const trail = [];
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
          chip.addEventListener('click', () => driveTo(n));
          el.appendChild(chip);
        });
      }

      function closePanel() {
        document.getElementById('sidePanel').classList.remove('open');
        clearSelection();
        requestAnimationFrame(resize);
      }
      document.getElementById('panelClose').addEventListener('click', closePanel);

      // ── legend filters ──
      function syncLegend() {
        document.querySelectorAll('.legend-item').forEach(btn => {
          btn.classList.toggle('off', !activeTypes.has(btn.dataset.type));
        });
      }
      document.querySelectorAll('.legend-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = btn.dataset.type;
          if (activeTypes.has(t)) {
            if (activeTypes.size === 1) return;
            activeTypes.delete(t);
          } else {
            activeTypes.add(t);
          }
          syncLegend();
          applyColors();
        });
      });

      // ── era strip + overview ──
      const strip = document.getElementById('eraStrip');
      CITY.districts.forEach((d, i) => {
        const seg = document.createElement('button');
        seg.className = 'era-seg';
        seg.title = d.label + ' (' + d.count + ')';
        seg.addEventListener('click', () => {
          if (mode !== 'aerial') setMode('aerial');
          flyToDistrict(d);
        });
        strip.appendChild(seg);
      });
      function flyToDistrict(d) {
        const mid = (d.zStart + d.zEnd) / 2;
        tweenCamera(
          new THREE.Vector3(46, 34, mid - 26),
          new THREE.Vector3(0, 2, mid),
          reduceMotion ? 0 : 900
        );
      }
      let lastDistrict = -1;
      function syncEraStrip() {
        const z = mode === 'drive' ? car.position.z : controls.target.z;
        let active = -1;
        CITY.districts.forEach((d, i) => { if (z >= d.zStart - 4 && z <= d.zEnd + 4) active = i; });
        strip.querySelectorAll('.era-seg').forEach((seg, i) => {
          seg.classList.toggle('active', i === active);
        });
        if (active !== lastDistrict) {
          lastDistrict = active;
          districtChipEl.textContent = active === -1 ? '' : CITY.districts[active].label;
          districtChipEl.classList.toggle('on', mode === 'drive' && active !== -1);
        }
      }

      function overview(ms) {
        tweenCamera(
          new THREE.Vector3(cityCenter.x + cityLen * 0.2, cityLen * 0.24, cityCenter.z - cityLen * 0.19),
          new THREE.Vector3(cityCenter.x, 0, cityCenter.z),
          ms === undefined ? (reduceMotion ? 0 : 1100) : ms
        );
      }
      modeBtn.addEventListener('click', () => {
        setMode(mode === 'drive' ? 'aerial' : 'drive');
      });

      // ── search ──
      const searchNodes = WIKI_DATA.nodes.map(n => ({ ...n, __norm: normalize(n.title), __deg: deg[n.id] || 0 }));
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
          item.addEventListener('mousedown', e => { e.preventDefault(); pickSearch(n); });
          searchResults.appendChild(item);
        });
        searchResults.classList.add('open');
      }
      function pickSearch(n) {
        searchResults.classList.remove('open');
        searchBox.value = n.title;
        searchBox.blur();
        driveTo(nodeById.get(n.id));
      }
      searchBox.addEventListener('input', () => {
        const q = normalize(searchBox.value.trim());
        if (!q) { matches = []; renderSearch(); return; }
        matches = searchNodes
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

      // ── hint ──
      let hintGone = false;
      function hideHint() {
        if (hintGone) return;
        hintGone = true;
        document.getElementById('hint').classList.add('gone');
      }
      function stopIntro() { hideHint(); }

      // opening shot: at the wheel, parked at the prehistoric gate
      if (reduceMotion) {
        setMode('aerial');
        overview(0);
      } else {
        carState.heading = 0; // facing down the avenue, into history
        camera.position.set(car.position.x, 5.4, car.position.z - 11.5);
        controls.target.set(car.position.x, 1.6, car.position.z + 7);
        setMode('drive');
      }

      // ── main loop ──
      const clock = new THREE.Clock();
      function animate() {
        requestAnimationFrame(animate);
        const dt = Math.min(0.05, clock.getDelta());
        const now = performance.now();

        stepDrive(now);
        stepManualDrive(dt);
        updateProximity(now);
        stepTween(now);
        if (!drive && mode === 'aerial') {
          clampTarget();
          controls.update();
        }
        // drifting clouds + sun tracking the view (keeps shadows crisp anywhere)
        if (!reduceMotion) {
          for (const cl of clouds) {
            cl.position.x += cl.userData.speed * dt;
            if (cl.position.x > 760) cl.position.x = -760;
          }
        }
        sun.position.set(controls.target.x + 70, 110, controls.target.z + 45);
        sun.target.position.set(controls.target.x, 0, controls.target.z);
        syncEraStrip();
        updateLabels();
        renderer.render(scene, camera);
      }
      animate();
      updateLabels(true);
    }
  </script>
</body>
</html>`;
}
