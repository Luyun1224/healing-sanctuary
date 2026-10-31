import { createStore } from '../lib/store';
import { load, save } from '../lib/storage';
import type { DayPhase } from '../lib/timeOfDay';

export type Quality = 'high' | 'low';

export interface Settings {
  quality: Quality;
  reduceMotion: boolean;
  timeMode: 'auto' | DayPhase;
  master: number;
  nature: number;
  music: number;
  sfx: number;
  fish: number;
  /** 室內誦唱／詩歌音量 */
  chant: number;
  /** 進入佛堂、教堂時播放室內氛圍 */
  interior: boolean;
  natureOnly: boolean;
  rain: boolean;
}

const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const isMobile = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px), (pointer: coarse)').matches;

const DEFAULTS: Settings = {
  quality: isMobile ? 'low' : 'high',
  reduceMotion: !!prefersReduced,
  timeMode: 'auto',
  master: 0.8,
  nature: 0.7,
  music: 0.5,
  sfx: 0.8,
  fish: 0.8,
  chant: 0.8,
  interior: true,
  natureOnly: false,
  rain: false,
};

export const settingsStore = createStore<Settings>(load('settings', DEFAULTS));
settingsStore.subscribe(() => save('settings', settingsStore.get()));
export const useSettings = settingsStore.useStore;

/** 聲音是否開啟：每次開啟網站都預設靜音，需使用者主動點擊（瀏覽器也要求使用者操作後才能播放） */
export const audioStore = createStore({ enabled: false });
