import * as THREE from 'three';
import type { AvatarConfig } from '../data/avatar';
import { createStore } from '../lib/store';
import type { Anim } from '../world/types';

export type NetStatus = 'disabled' | 'connecting' | 'online' | 'offline' | 'full';

export interface RemotePlayer {
  id: string;
  nickname: string;
  avatar: AvatarConfig;
  /** 伺服器最新位置（插值目標） */
  target: THREE.Vector3;
  /** 畫面上目前位置 */
  pos: THREE.Vector3;
  rot: number;
  targetRot: number;
  anim: Anim;
  eyesClosed: boolean;
  /** 最近一次收到此玩家新狀態的本機時間 */
  receivedAt: number;
  version: number;
  seated: '' | 's' | 'm';
  /** 收到預設互動時的一次性動作 */
  gesture: { anim: Anim; until: number } | null;
  /** 插值移動速度 */
  speed: number;
}

export interface Bubble {
  id: number;
  playerId: string;
  text: string;
  until: number;
}

export const netStore = createStore({
  status: 'disabled' as NetStatus,
  online: 0,
  roomName: '',
  /** 遠端玩家 ID 清單（變動時才觸發 React 重新渲染） */
  ids: [] as string[],
  bubbles: [] as Bubble[],
  focusMode: false,
  interval: 6000,
  lastOkAt: 0,
  selfId: '',
});
export const useNet = netStore.useStore;

/** 遠端玩家資料（每幀讀取，不經過 React） */
export const remotes = new Map<string, RemotePlayer>();

let bubbleId = 0;
export function addBubble(playerId: string, text: string) {
  const now = Date.now();
  const list = netStore.get().bubbles.filter((b) => b.until > now && b.playerId !== playerId);
  netStore.set({ bubbles: [...list, { id: ++bubbleId, playerId, text, until: now + 4500 }] });
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__net = { netStore, remotes };
}
