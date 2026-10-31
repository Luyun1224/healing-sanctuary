import type { Collider, Floor, Interactable, Rect } from '../types';

/**
 * 兩個場景共用的山谷地形：小溪（由西側瀑布流出）、拱橋、涼亭、溪邊長椅，以及樹林配置。
 * 所有位置資料集中於此，3D 元件與碰撞、座位、互動判定共用同一份資料。
 */
export const STREAM = { z: 10.2, halfWidth: 1.4, x0: -31, x1: 60 };
export const BRIDGE = { x: 0, z: STREAM.z, halfWidth: 1.2, halfLength: 1.9, h: 0.45 };
export const WATERFALL = { x: -33, z: STREAM.z, top: 9 };
export const WORLD_BOUNDS = 34;
/** Phase 4 山林探索：貓咪、魚池、祈願樹 */
export const CAT = { x: 5.2, z: 16.4 };
export const POND = { x: 16, z: 16, r: 2.1 };
export const WISH_TREE = { x: -19, z: 5 };
/** 散步路線（沿步道、過橋、繞花園；遇到障礙會自動跳到下一點） */
export const WALK_PATH: [number, number][] = [
  [0, 19],
  [-9, 17],
  [-18, 14],
  [-24, 13.2],
  [-14, 16.2],
  [-4, 13.4],
  [0, 12.8],
  [0, 7.6],
  [4, 4.5],
  [9, 3],
  [12, 7],
  [5, 8],
  [0, 8.4],
  [0, 12.8],
  [8, 18],
  [0, 20],
];

export const seatY = (surface: number) => surface - 0.33;

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const valleyColliders: Collider[] = [
  // 小溪（橋面以外不可通行）
  { type: 'box', x: (STREAM.x0 - 10 + -BRIDGE.halfWidth - 0.15) / 2, z: STREAM.z, hw: (-BRIDGE.halfWidth - 0.15 - (STREAM.x0 - 10)) / 2, hd: STREAM.halfWidth },
  { type: 'box', x: (BRIDGE.halfWidth + 0.15 + 50) / 2, z: STREAM.z, hw: (50 - BRIDGE.halfWidth - 0.15) / 2, hd: STREAM.halfWidth },
  // 橋的欄杆
  { type: 'box', x: -BRIDGE.halfWidth - 0.05, z: BRIDGE.z, hw: 0.08, hd: BRIDGE.halfLength },
  { type: 'box', x: BRIDGE.halfWidth + 0.05, z: BRIDGE.z, hw: 0.08, hd: BRIDGE.halfLength },
  // 瀑布山壁
  { type: 'box', x: WATERFALL.x - 3, z: WATERFALL.z, hw: 3, hd: 9 },
  { type: 'circle', x: POND.x, z: POND.z, r: POND.r + 0.2 },
  { type: 'circle', x: WISH_TREE.x, z: WISH_TREE.z, r: 0.7 },
  { type: 'circle', x: CAT.x, z: CAT.z, r: 0.3 },
];

/** 共用物件周圍不種樹 */
export const valleyClear: Rect[] = [
  { x: CAT.x, z: CAT.z, hw: 1.6, hd: 1.4 },
  { x: POND.x, z: POND.z, hw: 3.6, hd: 3.4 },
  { x: WISH_TREE.x, z: WISH_TREE.z, hw: 3, hd: 3 },
  { x: -10, z: 16, hw: 14, hd: 2.6 },
  { x: 8, z: 4, hw: 5.5, hd: 3.5 },
];

export const valleyFloors: Floor[] = [{ type: 'archZ', x: BRIDGE.x, z: BRIDGE.z, hw: BRIDGE.halfWidth, hd: BRIDGE.halfLength, h: BRIDGE.h }];

export const PAVILION = { x: -12, z: 3 };
export const STREAM_BENCH = { x: 7, z: 13.4 };

export const valleyInteractables: Interactable[] = [
  { id: 'cat', kind: 'cat', label: '曬太陽的貓咪', x: CAT.x, z: CAT.z, r: 1.6, face: [CAT.x, CAT.z] },
  { id: 'pond', kind: 'pond', label: '錦鯉池', x: POND.x - 2.7, z: POND.z, r: 1.5, face: [POND.x, POND.z] },
  { id: 'wish-tree', kind: 'wishTree', label: '祈願樹', x: WISH_TREE.x + 1.6, z: WISH_TREE.z + 0.8, r: 1.7, face: [WISH_TREE.x, WISH_TREE.z] },
  {
    id: 'waterfall',
    kind: 'waterfall',
    label: '瀑布',
    x: -26.5,
    z: 6.6,
    r: 2.2,
    seat: { x: -26.5, z: 6.6, y: 0, rot: -Math.PI / 2 - 0.35, pose: 'sit' },
  },
  {
    id: 'stream-bench',
    kind: 'bench',
    label: '溪邊長椅',
    x: STREAM_BENCH.x,
    z: STREAM_BENCH.z,
    r: 1.6,
    seat: { x: STREAM_BENCH.x, z: STREAM_BENCH.z + 0.05, y: seatY(0.45), rot: Math.PI, pose: 'sit' },
  },
];

export const valleyWater = [
  { x: WATERFALL.x + 2, z: WATERFALL.z, loud: 1 },
  { x: -15, z: STREAM.z, loud: 0.55 },
  { x: 0, z: STREAM.z, loud: 0.55 },
  { x: 15, z: STREAM.z, loud: 0.55 },
  { x: 30, z: STREAM.z, loud: 0.55 },
];

export interface TreeData {
  x: number;
  z: number;
  s: number;
  rot: number;
}

export interface Vegetation {
  pines: TreeData[];
  round: TreeData[];
  bamboo: TreeData[];
  flowers: (TreeData & { c: number })[];
  rocks: TreeData[];
  colliders: Collider[];
}

const inRect = (x: number, z: number, r: Rect, pad = 0) => Math.abs(x - r.x) <= r.hw + pad && Math.abs(z - r.z) <= r.hd + pad;

/** 以固定亂數種子產生植被；clear 為需要淨空的區域（建築、步道、廣場） */
export function makeVegetation(seed: number, clear: Rect[], bambooZones: Rect[], flowerZones: Rect[]): Vegetation {
  const rnd = mulberry32(seed);
  const blocked = (x: number, z: number, pad: number) =>
    clear.some((r) => inRect(x, z, r, pad)) || Math.abs(z - STREAM.z) < STREAM.halfWidth + 1.2 || (x < WATERFALL.x + 4 && Math.abs(z - WATERFALL.z) < 11);
  const v: Vegetation = { pines: [], round: [], bamboo: [], flowers: [], rocks: [], colliders: [] };

  // 可行走範圍內的樹（有碰撞）
  let tries = 0;
  while (v.pines.length + v.round.length < 46 && tries++ < 3000) {
    const a = rnd() * Math.PI * 2;
    const d = 15 + rnd() * (WORLD_BOUNDS - 13);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (blocked(x, z, 2)) continue;
    if ([...v.pines, ...v.round].some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) continue;
    const t = { x, z, s: 0.9 + rnd() * 0.7, rot: rnd() * Math.PI };
    (rnd() < 0.65 ? v.pines : v.round).push(t);
    if (d < WORLD_BOUNDS + 1) v.colliders.push({ type: 'circle', x, z, r: 0.45 * t.s });
  }
  // 邊界外的森林（純裝飾，形成被山林包圍的感覺）
  for (let i = 0; i < 170; i++) {
    const a = rnd() * Math.PI * 2;
    const d = WORLD_BOUNDS + 2 + rnd() * 34;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.abs(z - STREAM.z) < STREAM.halfWidth + 1 && x > 0) continue;
    (rnd() < 0.7 ? v.pines : v.round).push({ x, z, s: 1.1 + rnd() * 1.3, rot: rnd() * Math.PI });
  }
  // 竹林
  for (const zone of bambooZones) {
    const n = Math.round((zone.hw * zone.hd) / 1.6);
    for (let i = 0; i < n; i++) {
      const cx = zone.x + (rnd() * 2 - 1) * zone.hw;
      const cz = zone.z + (rnd() * 2 - 1) * zone.hd;
      if (blocked(cx, cz, 0.6)) continue;
      const stalks = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < stalks; k++) v.bamboo.push({ x: cx + (rnd() - 0.5) * 0.9, z: cz + (rnd() - 0.5) * 0.9, s: 0.75 + rnd() * 0.5, rot: (rnd() - 0.5) * 0.12 });
      v.colliders.push({ type: 'circle', x: cx, z: cz, r: 0.6 });
    }
  }
  // 花草
  for (const zone of flowerZones) {
    const n = Math.round(zone.hw * zone.hd * 2.2);
    for (let i = 0; i < n; i++) {
      const x = zone.x + (rnd() * 2 - 1) * zone.hw;
      const z = zone.z + (rnd() * 2 - 1) * zone.hd;
      v.flowers.push({ x, z, s: 0.7 + rnd() * 0.6, rot: rnd() * Math.PI, c: Math.floor(rnd() * 5) });
    }
  }
  // 溪邊石頭
  for (let x = STREAM.x0 + 2; x < 45; x += 1.6 + rnd() * 2.5) {
    if (Math.abs(x) < BRIDGE.halfWidth + 0.8) continue;
    for (const side of [-1, 1]) {
      if (rnd() < 0.35) continue;
      v.rocks.push({ x: x + rnd(), z: STREAM.z + side * (STREAM.halfWidth + 0.1 + rnd() * 0.4), s: 0.3 + rnd() * 0.45, rot: rnd() * Math.PI });
    }
  }
  return v;
}

/** 涼亭：六根柱子＋中央座椅（佛堂為木造涼亭，教堂為白色花園涼亭） */
export function pavilion(label: string) {
  const posts: Collider[] = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    return { type: 'circle', x: PAVILION.x + Math.cos(a) * 1.9, z: PAVILION.z + Math.sin(a) * 1.9, r: 0.18 };
  });
  const rot = Math.atan2(WATERFALL.x - PAVILION.x, WATERFALL.z - PAVILION.z);
  const seat: Interactable = {
    id: 'pavilion',
    kind: 'pavilion',
    label,
    x: PAVILION.x,
    z: PAVILION.z,
    r: 2,
    seat: { x: PAVILION.x - Math.sin(rot) * 0.0, z: PAVILION.z, y: seatY(0.45), rot, pose: 'sit' },
  };
  return { colliders: [...posts, { type: 'box', x: PAVILION.x, z: PAVILION.z, hw: 0.3, hd: 0.3 } as Collider], seat, rot };
}
