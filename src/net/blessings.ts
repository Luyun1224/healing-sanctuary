import { createStore } from '../lib/store';
import { load, loadRaw, save } from '../lib/storage';
import { callGas, GAS_URL } from './api';

/**
 * 祈福留言板：任何人都可以留言，不需登入或權限。
 * 留言存在 Google 試算表 BlessingWall，管理員可在後台移除不適當內容。
 * clientId 是隨機產生的匿名代碼，只用於伺服器端的「每分鐘一則」防洗版限制，不代表身分。
 */
export interface Blessing {
  id: string;
  nickname: string;
  content: string;
  at: number;
}

export const blessingStore = createStore({
  scene: '' as string,
  list: [] as Blessing[],
  status: 'idle' as 'idle' | 'loading' | 'ok' | 'offline',
});
export const useBlessings = blessingStore.useStore;

export const BLESSING_MAX = 60;

function clientId() {
  const saved = load('client', { id: '' });
  if (saved.id) return saved.id;
  const id = `c-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  save('client', { id });
  return id;
}

export async function refreshBlessings(scene: string) {
  const cached = loadRaw<Blessing[]>(`blessings:${scene}`) ?? [];
  if (blessingStore.get().scene !== scene) blessingStore.set({ scene, list: cached });
  if (!GAS_URL) return blessingStore.set({ status: 'offline' });
  blessingStore.set({ status: 'loading' });
  const res = await callGas<{ blessings: Blessing[] }>('getBlessings', { scene });
  if (blessingStore.get().scene !== scene) return;
  if (res.ok) {
    blessingStore.set({ list: res.blessings, status: 'ok' });
    save(`blessings:${scene}`, res.blessings.slice(0, 20));
  } else {
    blessingStore.set({ status: 'offline' });
  }
}

const ERRORS: Record<string, string> = {
  invalid: '請寫下 2～60 個字的祝福',
  blocked: '內容包含不適合公開的字詞，請修改後再送出',
  too_frequent: '每分鐘可以留一則祝福，請稍候再試',
  busy: '目前留言的人比較多，請稍後再試',
  not_configured: '尚未設定留言伺服器',
};

export async function postBlessing(scene: string, nickname: string, content: string): Promise<string | null> {
  const res = await callGas<{ id: string }>('postBlessing', { scene, nickname, content: content.trim().slice(0, BLESSING_MAX), clientId: clientId() });
  if (!res.ok) return ERRORS[res.error] ?? '暫時無法連線，請稍後再試';
  // 自己的留言立即顯示
  blessingStore.set({ list: [{ id: res.id, nickname: nickname || '匿名', content: content.trim(), at: Date.now() }, ...blessingStore.get().list].slice(0, 40) });
  void refreshBlessings(scene);
  return null;
}
