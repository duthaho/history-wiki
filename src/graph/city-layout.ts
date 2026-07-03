import type { GraphData, GraphNode, GraphEdge } from './build-graph.js';

/**
 * Deterministic build-time layout for the 3D knowledge city ("Phố cổ tri thức").
 *
 * Pure math — no three.js, no randomness (jitter comes from FNV-1a hashes of
 * node ids), so the same wiki always produces the same city and the layout is
 * fully unit-testable.
 *
 * City model: one straight "time avenue" along +Z. Each era is a district — a
 * consecutive segment of the avenue with buildings on both sides. Roads form a
 * Manhattan grid: the avenue spine plus one cross-street lane per district row.
 * Every building gets a doorstep node ("portal") on its lane, so the road graph
 * is connected by construction and a car can Dijkstra its way anywhere.
 */

export interface Vec2 {
  x: number;
  z: number;
}

export interface BuildingPlacement {
  id: string;
  era: string;
  position: Vec2;
  rotationY: number;
  width: number;
  depth: number;
  height: number;
  /** Road-graph node id at this building's doorstep. */
  portal: number;
}

export interface DistrictPlacement {
  era: string;
  label: string;
  index: number;
  zStart: number;
  zEnd: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  gate: Vec2;
  count: number;
}

export interface RoadNode {
  id: number;
  p: Vec2;
}

export interface RoadEdge {
  a: number;
  b: number;
  length: number;
  kind: 'avenue' | 'street';
}

export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadEdge[];
}

export interface CityLayout {
  districts: DistrictPlacement[];
  buildings: BuildingPlacement[];
  roads: RoadGraph;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** Chronological order of known era slugs. Unknown slugs append after these. */
export const ERA_ORDER: readonly string[] = [
  'prehistoric',
  'chinese-domination',
  'ngo-dinh',
  'ly-dynasty',
  'tran-dynasty',
  'ho-dynasty',
  'ming-domination',
  'le-dynasty',
  'mac-dynasty',
  'nguyen-dynasty',
  'french-colonization',
  'independence-wars',
  'reunification-doi-moi',
];

/** Vietnamese banner labels for district gates. */
export const ERA_LABELS: Record<string, string> = {
  prehistoric: 'Thời tiền sử',
  'chinese-domination': 'Bắc thuộc',
  'ngo-dinh': 'Ngô – Đinh – Tiền Lê',
  'ly-dynasty': 'Nhà Lý',
  'tran-dynasty': 'Nhà Trần',
  'ho-dynasty': 'Nhà Hồ',
  'ming-domination': 'Thuộc Minh',
  'le-dynasty': 'Nhà Lê',
  'mac-dynasty': 'Nhà Mạc',
  'nguyen-dynasty': 'Nhà Nguyễn',
  'french-colonization': 'Pháp thuộc',
  'independence-wars': 'Kháng chiến',
  'reunification-doi-moi': 'Thống nhất – Đổi mới',
};

// ── city constants ──
const AVENUE_W = 16; // avenue width
const SETBACK = 9; // sidewalk depth between avenue edge / lane and first plot
const PITCH = 19; // plot pitch, both axes — generous spacing between houses
const GATE_PAD = 12; // breathing room after a district gate before the first row
const DISTRICT_GAP = 14; // green gap between districts
const MAX_COLS = 3; // max building columns per side
const JITTER = 2.5; // total jitter span (±1.25)
const BUILDING_Z_OFFSET = 8; // building center sits this far past its lane (front edge clears the roadway)

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Deterministic [0,1) from a string — FNV-1a 32-bit. */
export function hashJitter(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

/** Undirected degree per node — A→B and B→A count once. */
export function undirectedDegrees(edges: GraphEdge[]): Map<string, number> {
  const seen = new Set<string>();
  const deg = new Map<string, number>();
  for (const e of edges) {
    const key = e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
    deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
  }
  return deg;
}

/** Era slugs present in the data, in chronological order (unknowns appended alphabetically). */
export function orderEras(nodes: GraphNode[]): string[] {
  const present = new Set(nodes.map((n) => n.era));
  const known = ERA_ORDER.filter((e) => present.has(e));
  const unknown = [...present].filter((e) => !ERA_ORDER.includes(e)).sort();
  return [...known, ...unknown];
}

/** Building size from undirected degree. Footprint max 7.5 < PITCH − JITTER − margin. */
export function buildingDimensions(
  degree: number,
  _maxDegree: number
): { width: number; depth: number; height: number } {
  const d = Math.max(0, degree);
  const height = round2(3 + 1.5 * Math.sqrt(d));
  const side = round2(5 + 2.5 * Math.min(1, d / 20));
  return { width: side, depth: side, height };
}

interface Slot {
  side: -1 | 1;
  col: number;
  row: number;
}

interface DistrictPlan {
  buildings: Array<Omit<BuildingPlacement, 'portal'> & { slot: Slot }>;
  /** z of each cross-street lane. */
  rows: number[];
  /** Per row, per side: highest occupied column index (-1 = none). */
  maxCol: Array<{ [side: number]: number }>;
  zEnd: number;
}

/**
 * Place one district's buildings.
 * Slots are filled column-first: every avenue-frontage plot (col 0) on both
 * sides fills before col 1, so the best-connected pages line the avenue.
 */
export function layoutDistrict(
  nodes: GraphNode[],
  degrees: Map<string, number>,
  maxDegree: number,
  zStart: number
): DistrictPlan {
  const sorted = [...nodes].sort((a, b) => {
    const d = (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });

  const n = sorted.length;
  const colsPerSide = Math.max(1, Math.min(MAX_COLS, Math.ceil(Math.sqrt(n / 2))));
  const slotsPerRow = 2 * colsPerSide;
  const rowCount = Math.max(1, Math.ceil(n / slotsPerRow));

  // Slot order: col 0 (both sides, all rows) → col 1 → col 2.
  const slots: Slot[] = [];
  for (let col = 0; col < colsPerSide; col++) {
    for (let row = 0; row < rowCount; row++) {
      for (const side of [-1, 1] as const) {
        slots.push({ side, col, row });
      }
    }
  }

  const rows: number[] = [];
  for (let r = 0; r < rowCount; r++) rows.push(round2(zStart + GATE_PAD + r * PITCH));

  const maxCol: Array<{ [side: number]: number }> = rows.map(() => ({ [-1]: -1, [1]: -1 }));

  const buildings: DistrictPlan['buildings'] = sorted.map((node, i) => {
    const slot = slots[i];
    const deg = degrees.get(node.id) ?? 0;
    const dims = buildingDimensions(deg, maxDegree);
    const jx = (hashJitter(node.id + ':x') - 0.5) * JITTER;
    const jz = (hashJitter(node.id + ':z') - 0.5) * JITTER;
    const x = slot.side * (AVENUE_W / 2 + SETBACK + slot.col * PITCH) + jx;
    const z = rows[slot.row] + BUILDING_Z_OFFSET + jz;
    // Face the avenue: local +z is the facade. Ry(θ)·ẑ = (sinθ, 0, cosθ), so
    // west side (x<0) needs θ=+π/2 (faces +x), east side θ=−π/2 (faces −x).
    const rotationY = round2(
      (slot.side < 0 ? Math.PI / 2 : -Math.PI / 2) + (hashJitter(node.id + ':r') - 0.5) * 0.12
    );
    maxCol[slot.row][slot.side] = Math.max(maxCol[slot.row][slot.side], slot.col);
    return {
      id: node.id,
      era: node.era,
      position: { x: round2(x), z: round2(z) },
      rotationY,
      ...dims,
      slot,
    };
  });

  const zEnd = round2(zStart + GATE_PAD + rowCount * PITCH + GATE_PAD);
  return { buildings, rows, maxCol, zEnd };
}

/** Number of connected components in the road graph (union-find). */
export function roadGraphComponents(roads: RoadGraph): number {
  if (roads.nodes.length === 0) return 0;
  const parent = roads.nodes.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (const e of roads.edges) {
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra !== rb) parent[ra] = rb;
  }
  const roots = new Set<number>();
  for (let i = 0; i < roads.nodes.length; i++) roots.add(find(i));
  return roots.size;
}

/** Full deterministic city layout: districts along the time avenue + road graph. */
export function computeCityLayout(data: GraphData): CityLayout {
  const degrees = undirectedDegrees(data.edges);
  const eras = orderEras(data.nodes);
  const maxDegree = Math.max(1, ...data.nodes.map((n) => degrees.get(n.id) ?? 0));

  const byEra = new Map<string, GraphNode[]>();
  for (const node of data.nodes) {
    const list = byEra.get(node.era) ?? [];
    list.push(node);
    byEra.set(node.era, list);
  }

  const districts: DistrictPlacement[] = [];
  const buildings: BuildingPlacement[] = [];

  const roadNodes: RoadNode[] = [];
  const roadEdges: RoadEdge[] = [];
  const nodeAt = new Map<string, number>();
  const addRoadNode = (x: number, z: number): number => {
    const key = `${round2(x)},${round2(z)}`;
    const existing = nodeAt.get(key);
    if (existing !== undefined) return existing;
    const id = roadNodes.length;
    roadNodes.push({ id, p: { x: round2(x), z: round2(z) } });
    nodeAt.set(key, id);
    return id;
  };
  const addRoadEdge = (a: number, b: number, kind: RoadEdge['kind']): void => {
    if (a === b) return;
    const pa = roadNodes[a].p;
    const pb = roadNodes[b].p;
    roadEdges.push({ a, b, length: round2(Math.hypot(pa.x - pb.x, pa.z - pb.z)), kind });
  };

  const avenueNodeIds: number[] = [];
  let z = 0;

  eras.forEach((era, index) => {
    const nodes = byEra.get(era) ?? [];
    const zStart = z;
    const plan = layoutDistrict(nodes, degrees, maxDegree, zStart);

    // Gate node on the avenue at the district entrance.
    const gateId = addRoadNode(0, zStart);
    avenueNodeIds.push(gateId);

    let minX = -AVENUE_W / 2;
    let maxX = AVENUE_W / 2;

    // One cross-street lane per row, chained outward from the avenue.
    const laneNodeIds: Array<{ [side: number]: number[] }> = plan.rows.map(() => ({
      [-1]: [],
      [1]: [],
    }));
    plan.rows.forEach((rowZ, r) => {
      const avenueId = addRoadNode(0, rowZ);
      avenueNodeIds.push(avenueId);
      for (const side of [-1, 1] as const) {
        let prev = avenueId;
        for (let col = 0; col <= plan.maxCol[r][side]; col++) {
          const laneX = side * (AVENUE_W / 2 + SETBACK + col * PITCH);
          const laneId = addRoadNode(laneX, rowZ);
          addRoadEdge(prev, laneId, 'street');
          laneNodeIds[r][side].push(laneId);
          prev = laneId;
          minX = Math.min(minX, laneX - PITCH / 2);
          maxX = Math.max(maxX, laneX + PITCH / 2);
        }
      }
    });

    // parallel back streets: link the same column across consecutive rows, so the
    // district is a real grid — every house reachable by more than one route
    for (const side of [-1, 1] as const) {
      for (let r = 1; r < plan.rows.length; r++) {
        const prevLanes = laneNodeIds[r - 1][side];
        const curLanes = laneNodeIds[r][side];
        const shared = Math.min(prevLanes.length, curLanes.length);
        for (let col = 0; col < shared; col++) {
          addRoadEdge(prevLanes[col], curLanes[col], 'street');
        }
      }
    }

    for (const b of plan.buildings) {
      const portal = laneNodeIds[b.slot.row][b.slot.side][b.slot.col];
      const { slot: _slot, ...placement } = b;
      buildings.push({ ...placement, portal });
    }

    districts.push({
      era,
      label: ERA_LABELS[era] ?? era,
      index,
      zStart: round2(zStart),
      zEnd: plan.zEnd,
      bounds: { minX: round2(minX), maxX: round2(maxX), minZ: round2(zStart), maxZ: plan.zEnd },
      gate: { x: 0, z: round2(zStart) },
      count: nodes.length,
    });

    z = plan.zEnd + DISTRICT_GAP;
  });

  // Chain the avenue spine in z-order.
  const uniqueAvenue = [...new Set(avenueNodeIds)].sort(
    (a, b) => roadNodes[a].p.z - roadNodes[b].p.z
  );
  for (let i = 1; i < uniqueAvenue.length; i++) {
    addRoadEdge(uniqueAvenue[i - 1], uniqueAvenue[i], 'avenue');
  }

  const bounds = districts.reduce(
    (acc, d) => ({
      minX: Math.min(acc.minX, d.bounds.minX),
      maxX: Math.max(acc.maxX, d.bounds.maxX),
      minZ: Math.min(acc.minZ, d.bounds.minZ),
      maxZ: Math.max(acc.maxZ, d.bounds.maxZ),
    }),
    { minX: -AVENUE_W / 2, maxX: AVENUE_W / 2, minZ: 0, maxZ: z }
  );
  bounds.minX = round2(bounds.minX);
  bounds.maxX = round2(bounds.maxX);
  bounds.minZ = round2(bounds.minZ);
  bounds.maxZ = round2(bounds.maxZ);

  return { districts, buildings, roads: { nodes: roadNodes, edges: roadEdges }, bounds };
}
