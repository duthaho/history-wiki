import { describe, it, expect } from 'vitest';
import type { GraphData, GraphNode, GraphEdge } from './build-graph.js';
import {
  ERA_ORDER,
  ERA_LABELS,
  computeCityLayout,
  undirectedDegrees,
  orderEras,
  buildingDimensions,
  roadGraphComponents,
  hashJitter,
} from './city-layout.js';

function makeNode(id: string, era: string, type = 'person'): GraphNode {
  return { id, title: id, type, era, category: 'people', slug: id };
}

/** Small synthetic wiki spanning several eras with a hub. */
function makeData(): GraphData {
  const nodes: GraphNode[] = [
    makeNode('hub', 'tran-dynasty', 'dynasty'),
    makeNode('a', 'tran-dynasty'),
    makeNode('b', 'tran-dynasty'),
    makeNode('c', 'ly-dynasty'),
    makeNode('d', 'ly-dynasty'),
    makeNode('e', 'prehistoric'),
    makeNode('f', 'reunification-doi-moi'),
    makeNode('g', 'tran-dynasty'),
  ];
  const edges: GraphEdge[] = [
    { source: 'hub', target: 'a' },
    { source: 'a', target: 'hub' }, // duplicate reverse edge — must not double-count
    { source: 'hub', target: 'b' },
    { source: 'hub', target: 'c' },
    { source: 'hub', target: 'd' },
    { source: 'c', target: 'd' },
    { source: 'e', target: 'f' },
  ];
  return { nodes, edges, pages: {} };
}

describe('undirectedDegrees', () => {
  it('dedupes bidirectional edge pairs', () => {
    const deg = undirectedDegrees(makeData().edges);
    expect(deg.get('hub')).toBe(4); // a, b, c, d — reverse a→hub not double-counted
    expect(deg.get('a')).toBe(1);
    expect(deg.get('c')).toBe(2);
  });
});

describe('orderEras', () => {
  it('returns present eras in chronological order', () => {
    expect(orderEras(makeData().nodes)).toEqual([
      'prehistoric',
      'ly-dynasty',
      'tran-dynasty',
      'reunification-doi-moi',
    ]);
  });

  it('appends unknown era slugs without throwing', () => {
    const nodes = [...makeData().nodes, makeNode('x', 'future-era')];
    const eras = orderEras(nodes);
    expect(eras[eras.length - 1]).toBe('future-era');
  });

  it('covers all 13 known slugs with labels', () => {
    expect(ERA_ORDER).toHaveLength(13);
    for (const era of ERA_ORDER) expect(ERA_LABELS[era]).toBeTruthy();
  });
});

describe('buildingDimensions', () => {
  it('is monotonic in degree', () => {
    let prev = 0;
    for (const d of [0, 1, 5, 9, 20, 39]) {
      const { height } = buildingDimensions(d, 39);
      expect(height).toBeGreaterThanOrEqual(prev);
      prev = height;
    }
  });

  it('keeps footprints under the plot pitch', () => {
    const { width, depth } = buildingDimensions(39, 39);
    expect(width).toBeLessThanOrEqual(7.5);
    expect(depth).toBeLessThanOrEqual(7.5);
  });
});

describe('hashJitter', () => {
  it('is deterministic and in [0, 1)', () => {
    expect(hashJitter('trần-hưng-đạo')).toBe(hashJitter('trần-hưng-đạo'));
    for (const s of ['a', 'b', 'hùng-vương:x', 'hùng-vương:z']) {
      const v = hashJitter(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('computeCityLayout', () => {
  const data = makeData();
  const layout = computeCityLayout(data);

  it('is deterministic', () => {
    expect(computeCityLayout(makeData())).toEqual(layout);
  });

  it('places every node exactly once', () => {
    expect(layout.buildings).toHaveLength(data.nodes.length);
    expect(new Set(layout.buildings.map((b) => b.id)).size).toBe(data.nodes.length);
  });

  it('orders districts chronologically without z overlap', () => {
    for (let i = 1; i < layout.districts.length; i++) {
      expect(layout.districts[i].index).toBe(i);
      expect(layout.districts[i].zStart).toBeGreaterThan(layout.districts[i - 1].zEnd);
    }
  });

  it('keeps each building inside its district z-range', () => {
    const byEra = new Map(layout.districts.map((d) => [d.era, d]));
    for (const b of layout.buildings) {
      const d = byEra.get(b.era)!;
      expect(b.position.z).toBeGreaterThan(d.zStart);
      expect(b.position.z).toBeLessThan(d.zEnd);
    }
  });

  it('has no overlapping building footprints (AABB)', () => {
    const bs = layout.buildings;
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i];
        const b = bs[j];
        const overlapX =
          Math.abs(a.position.x - b.position.x) < (a.width + b.width) / 2;
        const overlapZ =
          Math.abs(a.position.z - b.position.z) < (a.depth + b.depth) / 2;
        expect(overlapX && overlapZ).toBe(false);
      }
    }
  });

  it('gives every building a valid portal on a connected road graph', () => {
    for (const b of layout.buildings) {
      expect(b.portal).toBeGreaterThanOrEqual(0);
      expect(b.portal).toBeLessThan(layout.roads.nodes.length);
    }
    expect(roadGraphComponents(layout.roads)).toBe(1);
  });

  it('puts the highest-degree node on avenue frontage', () => {
    const hub = layout.buildings.find((b) => b.id === 'hub')!;
    // frontage plots sit at |x| = AVENUE_W/2 + SETBACK = 14 (±jitter)
    expect(Math.abs(hub.position.x)).toBeLessThan(16);
  });

  it('road edges all have positive length and valid endpoints', () => {
    for (const e of layout.roads.edges) {
      expect(e.length).toBeGreaterThan(0);
      expect(layout.roads.nodes[e.a]).toBeDefined();
      expect(layout.roads.nodes[e.b]).toBeDefined();
    }
  });
});

describe('computeCityLayout on realistic scale', () => {
  it('handles 240 nodes across all eras with a connected road net', () => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let i = 0;
    for (const era of ERA_ORDER) {
      const count = 5 + ((i * 7) % 25);
      for (let k = 0; k < count; k++) {
        const id = `${era}-n${k}`;
        nodes.push(makeNode(id, era));
        if (k > 0) edges.push({ source: `${era}-n0`, target: id });
      }
      i++;
    }
    const layout = computeCityLayout({ nodes, edges, pages: {} });
    expect(layout.buildings).toHaveLength(nodes.length);
    expect(roadGraphComponents(layout.roads)).toBe(1);
    expect(layout.districts).toHaveLength(13);
    // avenue should be long but bounded
    expect(layout.bounds.maxZ).toBeGreaterThan(300);
    expect(layout.bounds.maxZ).toBeLessThan(2000);
  });
});
