// Gleisnetz aus legacy/eisenbahn-spiel (1280 x 720). Gerichtete Kanten als quadratische Kurven.

export const WIDTH = 1280;
export const HEIGHT = 720;

export type StationKey = 'B' | 'W' | 'C' | 'M';

export interface Point {
  x: number;
  y: number;
}

export interface TrackNode extends Point {
  id: string;
  type: 'spawn' | 'switch' | 'waypoint' | 'station';
  /** Weichennummer 1..9 */
  num?: number;
  station?: StationKey;
}

export interface Edge {
  from: string;
  to: string;
  cp: Point;
  length: number;
}

export const STATIONS: Record<StationKey, { name: string }> = {
  B: { name: 'Buxtehude' },
  W: { name: 'Wanne-Eickel' },
  C: { name: 'Castrop-Rauxel' },
  M: { name: 'Bad Meingarten' },
};
export const STATION_KEYS = Object.keys(STATIONS) as StationKey[];

const node = (
  id: string,
  x: number,
  y: number,
  type: TrackNode['type'],
  extra: Partial<TrackNode> = {},
): TrackNode => ({
  id,
  x,
  y,
  type,
  ...extra,
});

export const NODES: Record<string, TrackNode> = Object.fromEntries(
  [
    node('SPAWN_N', 95, 205, 'spawn'),
    node('SPAWN_S', 95, 515, 'spawn'),
    node('SW1', 275, 205, 'switch', { num: 1 }),
    node('SW2', 275, 515, 'switch', { num: 2 }),
    node('SW3', 480, 140, 'switch', { num: 3 }),
    node('SW4', 480, 360, 'switch', { num: 4 }),
    node('SW5', 480, 580, 'switch', { num: 5 }),
    node('SW6', 760, 230, 'switch', { num: 6 }),
    node('SW7', 760, 490, 'switch', { num: 7 }),
    node('SW8', 980, 175, 'switch', { num: 8 }),
    node('SW9', 980, 545, 'switch', { num: 9 }),
    node('LOOP_TOP', 620, 65, 'waypoint'),
    node('LOOP_BOT', 620, 655, 'waypoint'),
    node('ST_B', 1175, 105, 'station', { station: 'B' }),
    node('ST_W', 1175, 265, 'station', { station: 'W' }),
    node('ST_C', 1175, 455, 'station', { station: 'C' }),
    node('ST_M', 1175, 615, 'station', { station: 'M' }),
  ].map((n) => [n.id, n]),
);

const RAW: [string, string, number, number][] = [
  ['SPAWN_N', 'SW1', 185, 205],
  ['SPAWN_S', 'SW2', 185, 515],
  ['SW1', 'SW3', 375, 140],
  ['SW1', 'SW4', 380, 290],
  ['SW2', 'SW5', 375, 580],
  ['SW2', 'SW4', 380, 430],
  ['SW3', 'SW6', 620, 180],
  ['SW3', 'LOOP_TOP', 540, 65],
  ['LOOP_TOP', 'SW8', 820, 65],
  ['SW4', 'SW6', 620, 295],
  ['SW4', 'SW7', 620, 425],
  ['SW5', 'SW7', 620, 540],
  ['SW5', 'LOOP_BOT', 540, 655],
  ['LOOP_BOT', 'SW9', 820, 655],
  ['SW6', 'SW8', 870, 175],
  ['SW6', 'SW9', 870, 390],
  ['SW7', 'SW9', 870, 545],
  ['SW7', 'SW8', 870, 330],
  ['SW8', 'ST_B', 1075, 105],
  ['SW8', 'ST_W', 1075, 265],
  ['SW9', 'ST_C', 1075, 455],
  ['SW9', 'ST_M', 1075, 615],
];

export function quadPoint(p0: Point, cp: Point, p1: Point, t: number): Point {
  const inv = 1 - t;
  return {
    x: inv * inv * p0.x + 2 * inv * t * cp.x + t * t * p1.x,
    y: inv * inv * p0.y + 2 * inv * t * cp.y + t * t * p1.y,
  };
}

export function quadAngle(p0: Point, cp: Point, p1: Point, t: number): number {
  const dx = 2 * (1 - t) * (cp.x - p0.x) + 2 * t * (p1.x - cp.x);
  const dy = 2 * (1 - t) * (cp.y - p0.y) + 2 * t * (p1.y - cp.y);
  return Math.atan2(dy, dx);
}

function curveLength(p0: Point, cp: Point, p1: Point): number {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= 20; i++) {
    const pt = quadPoint(p0, cp, p1, i / 20);
    len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return len;
}

export const EDGES: Edge[] = RAW.map(([from, to, x, y]) => ({
  from,
  to,
  cp: { x, y },
  length: curveLength(NODES[from] as TrackNode, { x, y }, NODES[to] as TrackNode),
}));

/** Ausgehende Kanten (Indizes in EDGES) pro Knoten. Bei Weichen: [0] und [1]. */
export const OUT: Record<string, number[]> = Object.fromEntries(
  Object.keys(NODES).map((id) => [id, EDGES.flatMap((e, i) => (e.from === id ? [i] : []))]),
);

export const SWITCHES = Object.values(NODES).filter((n) => n.type === 'switch');

export function edgePoint(edgeIndex: number, t: number): Point & { angle: number } {
  const e = EDGES[edgeIndex] as Edge;
  const a = NODES[e.from] as TrackNode;
  const b = NODES[e.to] as TrackNode;
  return { ...quadPoint(a, e.cp, b, t), angle: quadAngle(a, e.cp, b, t) };
}
