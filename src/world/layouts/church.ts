import type { Collider, Floor, Interactable, Rect, SceneLayout } from '../types';
import { wallColliders } from '../physics';
import {
  WORLD_BOUNDS,
  makeVegetation,
  pavilion,
  seatY,
  valleyColliders,
  valleyFloors,
  valleyInteractables,
  valleyWater,
} from './valley';

/**
 * 平安教堂配置
 * 教堂大門面向 +Z；左前方鐘樓，前方花園與祝福看板，左側白色花園涼亭，右側觀景長椅。
 */
export const CHURCH = {
  platform: { x: 0, z: -9.6, hw: 6.4, hd: 7.6, h: 0.3 },
  nave: { x0: -5, x1: 5, z0: -16.2, z1: -3.6, door: 1.3, height: 3.6 },
  chancel: { z0: -16.2, z1: -13.6, h: 0.22 },
  pews: { xs: [-2.45, 2.45], zs: [-6.4, -8.1, -9.8, -11.5], hw: 1.45 },
  altar: { x: 0, z: -15 },
  candles: { x: -4.1, z: -14.7 },
  piano: { x: 3.9, z: -14.7 },
  tower: { x: -6.6, z: -4.8, hw: 1.3, hd: 1.3 },
  board: { x: 2.9, z: -1.0 },
  bench: { x: 11, z: -2 },
};

const P = CHURCH.platform;
const N = CHURCH.nave;
const fh = P.h;

export const CHURCH_CANDLE_IDS = Array.from({ length: 9 }, (_, i) => `candle-${i}`);

const pav = pavilion('花園涼亭');
const interior: Rect = { x: 0, z: (N.z0 + N.z1) / 2, hw: (N.x1 - N.x0) / 2, hd: (N.z1 - N.z0) / 2 };

const clear: Rect[] = [
  { x: P.x, z: P.z, hw: P.hw + 1.5, hd: P.hd + 1 },
  { x: CHURCH.tower.x, z: CHURCH.tower.z, hw: 2.5, hd: 2.5 },
  { x: 0, z: 10, hw: 2.6, hd: 14 },
  { x: -12, z: 3, hw: 3.4, hd: 3.4 },
  { x: 7, z: 13.4, hw: 2, hd: 1.4 },
  { x: CHURCH.bench.x, z: CHURCH.bench.z, hw: 2, hd: 1.6 },
  { x: -24, z: 6.5, hw: 4, hd: 2.5 },
  { x: 0, z: 3, hw: 8, hd: 3 }, // 花園
];

export const churchVegetation = makeVegetation(
  20251225,
  clear,
  [],
  [
    { x: -4.6, z: 2.6, hw: 2.2, hd: 2.2 },
    { x: 4.6, z: 2.6, hw: 2.2, hd: 2.2 },
    { x: -8, z: -1, hw: 1.4, hd: 1.4 },
    { x: 8, z: 1.5, hw: 1.6, hd: 1.4 },
    { x: -9, z: 14.5, hw: 2.5, hd: 1.2 },
    { x: 11, z: 6, hw: 2.2, hd: 1.4 },
    { x: -14, z: -9, hw: 2, hd: 3 },
    { x: 14, z: -9, hw: 2, hd: 3 },
  ],
);

const pewSurface = fh + 0.45;

const interactables: Interactable[] = [
  ...CHURCH.pews.xs.flatMap((x, side) =>
    CHURCH.pews.zs.map((z, row) => {
      const sx = x + (x < 0 ? 0.7 : -0.7);
      return {
        id: `pew-${side}-${row}`,
        kind: 'pew' as const,
        label: '木製長椅',
        x: sx,
        z: z - 0.75,
        r: 1.1,
        seat: { x: sx, z: z - 0.02, y: seatY(pewSurface), rot: Math.PI, pose: 'sit' as const },
      };
    }),
  ),
  { id: 'altar', kind: 'altar', label: '祭壇前', x: 0, z: -12.9, r: 1.3, face: [CHURCH.altar.x, CHURCH.altar.z] },
  { id: 'candles', kind: 'candles', label: '祝福蠟燭', x: CHURCH.candles.x + 0.9, z: CHURCH.candles.z + 0.6, r: 1.5, face: [CHURCH.candles.x, CHURCH.candles.z] },
  {
    id: 'piano',
    kind: 'piano',
    label: '鋼琴角落',
    x: CHURCH.piano.x - 0.9,
    z: CHURCH.piano.z + 0.6,
    r: 1.5,
    face: [CHURCH.piano.x, CHURCH.piano.z],
  },
  { id: 'board', kind: 'board', label: '今日祝福看板', x: CHURCH.board.x, z: CHURCH.board.z + 1.1, r: 1.5, face: [CHURCH.board.x, CHURCH.board.z] },
  { id: 'church-bell', kind: 'churchBell', label: '鐘樓', x: CHURCH.tower.x + 0.4, z: CHURCH.tower.z + 2.1, r: 1.5, face: [CHURCH.tower.x, CHURCH.tower.z] },
  {
    id: 'garden-bench',
    kind: 'bench',
    label: '花園長椅',
    x: CHURCH.bench.x,
    z: CHURCH.bench.z,
    r: 1.6,
    seat: { x: CHURCH.bench.x + 0.05, z: CHURCH.bench.z, y: seatY(0.45), rot: Math.PI / 2, pose: 'sit' },
  },
  pav.seat,
  ...valleyInteractables,
];

const colliders: Collider[] = [
  ...valleyColliders,
  ...pav.colliders,
  ...wallColliders([
    [N.x0, N.z0, N.x1, N.z0],
    [N.x0, N.z0, N.x0, N.z1],
    [N.x1, N.z0, N.x1, N.z1],
    [N.x0, N.z1, -N.door, N.z1],
    [N.door, N.z1, N.x1, N.z1],
  ]),
  ...CHURCH.pews.xs.flatMap((x) => CHURCH.pews.zs.map((z): Collider => ({ type: 'box', x, z: z - 0.05, hw: CHURCH.pews.hw, hd: 0.22 }))),
  { type: 'box', x: CHURCH.altar.x, z: CHURCH.altar.z, hw: 1.3, hd: 0.45 },
  { type: 'box', x: CHURCH.candles.x, z: CHURCH.candles.z, hw: 0.55, hd: 0.35 },
  { type: 'box', x: CHURCH.piano.x, z: CHURCH.piano.z, hw: 0.75, hd: 0.45 },
  { type: 'box', x: CHURCH.tower.x, z: CHURCH.tower.z, hw: CHURCH.tower.hw, hd: CHURCH.tower.hd },
  { type: 'box', x: CHURCH.board.x, z: CHURCH.board.z, hw: 0.6, hd: 0.15 },
  { type: 'box', x: CHURCH.bench.x + 0.35, z: CHURCH.bench.z, hw: 0.12, hd: 0.9 },
  { type: 'box', x: 7, z: 13.75, hw: 0.9, hd: 0.12 },
  // 花園中央噴水池
  { type: 'circle', x: 0, z: 3.2, r: 1.25 },
  ...churchVegetation.colliders,
];

const floors: Floor[] = [
  ...valleyFloors,
  { type: 'flat', x: P.x, z: P.z, hw: P.hw, hd: P.hd, h: fh },
  { type: 'flat', x: 0, z: (CHURCH.chancel.z0 + CHURCH.chancel.z1) / 2, hw: 4.8, hd: (CHURCH.chancel.z1 - CHURCH.chancel.z0) / 2, h: fh + CHURCH.chancel.h },
  { type: 'rampZ', x: 0, z: P.z + P.hd + 0.45, hw: 2, hd: 0.45, h0: fh, h1: 0 },
];

export const churchLayout: SceneLayout = {
  spawn: { x: 0, z: 21, rot: Math.PI },
  bounds: WORLD_BOUNDS,
  colliders,
  floors,
  interactables,
  interior,
  waterSources: valleyWater,
};
