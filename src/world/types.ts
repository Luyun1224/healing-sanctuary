export type Anim =
  | 'idle'
  | 'walk'
  | 'sit'
  | 'pray'
  | 'bow'
  | 'handsTogether'
  | 'meditate'
  | 'wave'
  | 'happy'
  | 'fishDrum';

export type InteractKind =
  | 'fish'
  | 'buddha'
  | 'cushion'
  | 'lamp'
  | 'templeBell'
  | 'bench'
  | 'pavilion'
  | 'waterfall'
  | 'pew'
  | 'candles'
  | 'board'
  | 'piano'
  | 'churchBell'
  | 'altar';

/** 座位：角色坐下時的位置（x,z）、根節點高度、面向角度 */
export interface Seat {
  x: number;
  z: number;
  y: number;
  rot: number;
  pose: 'sit' | 'meditate';
}

export interface Interactable {
  id: string;
  kind: InteractKind;
  label: string;
  x: number;
  z: number;
  /** 觸發互動提示的距離 */
  r: number;
  seat?: Seat;
  /** 互動時角色要面向的位置 */
  face?: [number, number];
}

export type Collider =
  | { type: 'box'; x: number; z: number; hw: number; hd: number }
  | { type: 'circle'; x: number; z: number; r: number };

/** 可行走的地面高度區塊：平台、斜坡（沿 z 軸由 h0 → h1）、拱橋（沿 z 軸） */
export type Floor =
  | { type: 'flat'; x: number; z: number; hw: number; hd: number; h: number }
  | { type: 'rampZ'; x: number; z: number; hw: number; hd: number; h0: number; h1: number }
  | { type: 'archZ'; x: number; z: number; hw: number; hd: number; h: number };

export interface Rect {
  x: number;
  z: number;
  hw: number;
  hd: number;
}

export interface SceneLayout {
  spawn: { x: number; z: number; rot: number };
  bounds: number;
  colliders: Collider[];
  floors: Floor[];
  interactables: Interactable[];
  /** 建築室內範圍：玩家進入時隱藏屋頂，方便看見室內 */
  interior: Rect;
  /** 水聲來源（小溪、瀑布）用於音量遠近 */
  waterSources: { x: number; z: number; loud: number }[];
}
