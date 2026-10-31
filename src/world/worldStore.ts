import * as THREE from 'three';
import { createStore } from '../lib/store';
import { load, save } from '../lib/storage';
import type { SceneId } from '../config/scenes';
import type { Anim, Interactable, Seat } from './types';

export interface Toast {
  id: number;
  text: string;
  sub?: string;
}

export interface Meditation {
  duration: number;
  endAt: number;
  pausedLeft: number | null;
  done: boolean;
}

export interface WorldState {
  scene: SceneId;
  /** 基本動作（坐下、靜坐、合掌、禱告、敲木魚等持續狀態） */
  baseAnim: Anim;
  /** 一次性動作（揮手、開心、鞠躬），結束後回到 baseAnim */
  gesture: { anim: Anim; until: number } | null;
  eyesClosed: boolean;
  seat: (Seat & { id: string }) | null;
  nearby: Interactable | null;
  inside: boolean;
  fishAuto: boolean;
  fishCount: number;
  lastStrike: number;
  litLamps: string[];
  litCandles: string[];
  bellAt: number;
  meditation: Meditation | null;
  toast: Toast | null;
  track: 'zen' | 'piano' | 'organ' | null;
  /** 點擊地面移動的目標 */
  moveTarget: [number, number] | null;
}

const counts = load('counts', { fish: 0 });

export const worldStore = createStore<WorldState>({
  scene: 'temple',
  baseAnim: 'idle',
  gesture: null,
  eyesClosed: false,
  seat: null,
  nearby: null,
  inside: false,
  fishAuto: false,
  fishCount: counts.fish,
  lastStrike: 0,
  litLamps: [],
  litCandles: [],
  bellAt: 0,
  meditation: null,
  toast: null,
  track: null,
  moveTarget: null,
});
export const useWorld = worldStore.useStore;

/** 玩家即時狀態（每幀更新，不觸發 React 重新渲染） */
export const player = {
  pos: new THREE.Vector3(),
  rot: 0,
  moving: false,
  speed: 0,
  /** 互動時要面向的位置 */
  face: null as [number, number] | null,
};

/** 鍵盤／搖桿輸入（-1..1）；cam 為鏡頭左右旋轉（Q / E） */
export const input = { x: 0, z: 0, joyX: 0, joyZ: 0, cam: 0 };

let toastId = 0;
export function showToast(text: string, sub?: string) {
  worldStore.set({ toast: { id: ++toastId, text, sub } });
}

export function resetWorld(scene: SceneId) {
  worldStore.set({
    scene,
    baseAnim: 'idle',
    gesture: null,
    eyesClosed: false,
    seat: null,
    nearby: null,
    inside: false,
    fishAuto: false,
    meditation: null,
    toast: null,
    track: null,
    moveTarget: null,
    litLamps: [],
    litCandles: [],
  });
}

const GESTURE_MS: Partial<Record<Anim, number>> = { wave: 2200, happy: 1800, bow: 2600 };

export function playGesture(anim: Anim) {
  worldStore.set({ gesture: { anim, until: performance.now() + (GESTURE_MS[anim] ?? 2000) } });
}

/** 持續動作：坐著時合掌／禱告維持坐姿，站著時就地進行 */
export function setBaseAnim(anim: Anim, eyesClosed = false) {
  worldStore.set({ baseAnim: anim, eyesClosed, gesture: null });
}

export function sitAt(id: string, seat: Seat) {
  worldStore.set({
    seat: { ...seat, id },
    baseAnim: seat.pose === 'meditate' ? 'meditate' : 'sit',
    eyesClosed: seat.pose === 'meditate',
    gesture: null,
    moveTarget: null,
  });
}

/** 任何移動輸入都會讓角色起身並停止持續動作 */
export function standUp() {
  const s = worldStore.get();
  if (!s.seat && s.baseAnim === 'idle' && !s.fishAuto && !s.meditation) return;
  worldStore.set({ seat: null, baseAnim: 'idle', eyesClosed: false, fishAuto: false, meditation: null });
}

export function strikeFish() {
  const s = worldStore.get();
  const fishCount = s.fishCount + 1;
  save('counts', { fish: fishCount });
  worldStore.set({ fishCount, lastStrike: performance.now(), baseAnim: 'fishDrum', gesture: null, eyesClosed: false });
}

// 開發模式下提供自動化測試用的除錯介面（正式建置不包含）
if (import.meta.env.DEV && typeof window !== 'undefined') {
  void import('../audio/engine').then(({ audio }) => {
    (window as unknown as Record<string, unknown>).__hs = { worldStore, player, input, audio };
  });
  (window as unknown as Record<string, unknown>).__hs = { worldStore, player, input };
}
