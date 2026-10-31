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
  valleyClear,
} from './valley';

/**
 * 靜心佛堂配置
 * 佛堂坐北朝南（大門面向 +Z），前方石階、小溪與拱橋，右前方鐘亭，左前方涼亭，兩側及後方竹林。
 */
export const TEMPLE = {
  platform: { x: 0, z: -8, hw: 8, hd: 6.8, h: 0.5 },
  hall: { x0: -6, x1: 6, z0: -13.2, z1: -3, door: 1.7, height: 3.1 },
  buddha: { x: 0, z: -12 },
  altar: { x: 0, z: -10.4 },
  fish: { x: -2.8, z: -9.4 },
  lamps: { x: 5.25, z: -9.2 },
  cushions: [
    [-1.1, -7.9],
    [1.1, -7.9],
    [-1.1, -6.1],
    [1.1, -6.1],
    [2.9, -7.0],
  ] as [number, number][],
  bell: { x: 11, z: -4 },
  /** 平安燈旁的功德箱與祈福留言板（靠右牆、面向室內） */
  offering: { x: 5.35, z: -5.1 },
};

const P = TEMPLE.platform;
const H = TEMPLE.hall;
const floorH = P.h;

export const TEMPLE_LAMP_IDS = Array.from({ length: 8 }, (_, i) => `lamp-${i}`);

const pav = pavilion('木造涼亭');

const interior: Rect = { x: 0, z: (H.z0 + H.z1) / 2, hw: (H.x1 - H.x0) / 2, hd: (H.z1 - H.z0) / 2 };

const clear: Rect[] = [
  ...valleyClear,
  { x: P.x, z: P.z, hw: P.hw + 1, hd: P.hd + 1 },
  { x: 0, z: 10, hw: 2.6, hd: 14 }, // 主步道
  { x: TEMPLE.bell.x, z: TEMPLE.bell.z, hw: 2.6, hd: 2.6 },
  { x: -12, z: 3, hw: 3.4, hd: 3.4 }, // 涼亭
  { x: 7, z: 13.4, hw: 2, hd: 1.4 }, // 溪邊長椅
  { x: -24, z: 6.5, hw: 4, hd: 2.5 }, // 瀑布觀景
];

export const templeVegetation = makeVegetation(
  20251031,
  clear,
  [
    { x: -12.5, z: -11, hw: 3.2, hd: 5 },
    { x: 13, z: -12.5, hw: 3, hd: 4 },
    { x: 0, z: -19, hw: 9, hd: 2 },
    { x: -15.5, z: -3, hw: 1.6, hd: 2.5 },
  ],
  [
    { x: -4.2, z: 3.5, hw: 1.4, hd: 2.2 },
    { x: 4.2, z: 3.5, hw: 1.4, hd: 2.2 },
    { x: -9, z: 14.5, hw: 2.5, hd: 1.2 },
    { x: 11, z: 6, hw: 2.2, hd: 1.4 },
  ],
);

const cushionSurface = floorH + 0.14;

const interactables: Interactable[] = [
  {
    id: 'fish',
    kind: 'fish',
    label: '木魚',
    x: TEMPLE.fish.x,
    z: TEMPLE.fish.z + 0.9,
    r: 1.5,
    seat: { x: TEMPLE.fish.x, z: TEMPLE.fish.z + 0.8, y: seatY(cushionSurface) + 0.06, rot: Math.PI, pose: 'meditate' },
    face: [TEMPLE.fish.x, TEMPLE.fish.z],
  },
  { id: 'buddha', kind: 'buddha', label: '佛像前', x: 0, z: -9.3, r: 1.5, face: [TEMPLE.buddha.x, TEMPLE.buddha.z] },
  {
    id: 'lamps',
    kind: 'lamp',
    label: '平安燈',
    x: TEMPLE.lamps.x - 1.1,
    z: TEMPLE.lamps.z,
    r: 1.7,
    face: [TEMPLE.lamps.x, TEMPLE.lamps.z],
  },
  ...TEMPLE.cushions.map(([x, z], i) => ({
    id: `cushion-${i}`,
    kind: 'cushion' as const,
    label: '蒲團',
    x,
    z,
    r: 0.85,
    seat: { x, z, y: seatY(cushionSurface) + 0.06, rot: Math.PI, pose: 'meditate' as const },
  })),
  { id: 'offering', kind: 'offering', label: '祈福留言板', x: TEMPLE.offering.x - 1.15, z: TEMPLE.offering.z, r: 1.3, face: [TEMPLE.offering.x, TEMPLE.offering.z] },
  { id: 'temple-bell', kind: 'templeBell', label: '寺院鐘', x: TEMPLE.bell.x, z: TEMPLE.bell.z + 2, r: 1.8, face: [TEMPLE.bell.x, TEMPLE.bell.z] },
  pav.seat,
  { id: "flowers", kind: "flowers", label: "花圃", x: 2.4, z: 6.1, r: 1.6 },
  ...valleyInteractables,
];

const colliders: Collider[] = [
  ...valleyColliders,
  ...pav.colliders,
  ...wallColliders([
    [H.x0, H.z0, H.x1, H.z0],
    [H.x0, H.z0, H.x0, H.z1],
    [H.x1, H.z0, H.x1, H.z1],
    [H.x0, H.z1, -H.door, H.z1],
    [H.door, H.z1, H.x1, H.z1],
  ]),
  // 迴廊柱子
  ...[-6.6, -3.4, 3.4, 6.6].map((x): Collider => ({ type: 'circle', x, z: -1.95, r: 0.2 })),
  // 佛像台座與供桌
  { type: 'box', x: TEMPLE.buddha.x, z: TEMPLE.buddha.z - 0.2, hw: 1.7, hd: 1 },
  { type: 'box', x: TEMPLE.altar.x, z: TEMPLE.altar.z, hw: 1.4, hd: 0.42 },
  { type: 'circle', x: TEMPLE.fish.x, z: TEMPLE.fish.z, r: 0.42 },
  { type: 'box', x: TEMPLE.lamps.x, z: TEMPLE.lamps.z, hw: 0.45, hd: 1.9 },
  { type: 'box', x: TEMPLE.offering.x, z: TEMPLE.offering.z, hw: 0.45, hd: 0.75 },
  // 鐘亭與香爐
  { type: 'box', x: TEMPLE.bell.x, z: TEMPLE.bell.z, hw: 1.15, hd: 1.15 },
  { type: 'circle', x: 0, z: 0.9, r: 0.55 },
  // 石燈籠
  ...[-2.2, 2.2].flatMap((x) => [4.5, 15.5].map((z): Collider => ({ type: 'circle', x, z, r: 0.3 }))),
  // 溪邊長椅
  { type: 'box', x: 7, z: 13.75, hw: 0.9, hd: 0.12 },
  ...templeVegetation.colliders,
];

const floors: Floor[] = [
  ...valleyFloors,
  { type: 'flat', x: P.x, z: P.z, hw: P.hw, hd: P.hd, h: P.h },
  { type: 'rampZ', x: 0, z: P.z + P.hd + 0.6, hw: 2.4, hd: 0.6, h0: P.h, h1: 0 },
];

export const templeLayout: SceneLayout = {
  spawn: { x: 0, z: 21, rot: Math.PI },
  bounds: WORLD_BOUNDS,
  colliders,
  floors,
  interactables,
  interior,
  waterSources: valleyWater,
};
