import { audio } from '../audio/engine';
import { CANDLE_BLESSINGS, LAMP_BLESSINGS, MEDITATION_DONE, pickOne } from '../data/blessings';
import { WORRY_DONE } from '../data/healing';
import { WALK_PATH } from './layouts/valley';
import { TEMPLE_LAMP_IDS } from './layouts/temple';
import { CHURCH_CANDLE_IDS } from './layouts/church';
import { heightAt } from './physics';
import type { Interactable, SceneLayout } from './types';
import { player, playGesture, setBaseAnim, showToast, sitAt, standUp, strikeFish, worldStore } from './worldStore';

/** 所有玩家動作集中於此：更新狀態＋播放音效（Phase 2 起也會在這裡把動作狀態交給同步模組） */

function faceTo(it: Interactable | null) {
  if (it?.face) player.face = it.face;
}

export function sitOn(it: Interactable) {
  if (!it.seat) return;
  sitAt(it.id, it.seat);
}

export function sitOnGround(layout: SceneLayout, meditate: boolean) {
  const y = heightAt(layout.floors, player.pos.x, player.pos.z);
  sitAt('ground', { x: player.pos.x, z: player.pos.z, y: y - (meditate ? 0.2 : 0.24), rot: player.rot, pose: meditate ? 'meditate' : 'sit' });
}

export function strike() {
  const s = worldStore.get();
  if (s.nearby?.kind === 'fish' && s.seat?.id !== 'fish') sitOn(s.nearby);
  strikeFish();
  audio.playFish();
}

export function setFishAuto(on: boolean) {
  worldStore.set({ fishAuto: on });
  if (on) strike();
}

export function handsTogether(it: Interactable | null = null) {
  faceTo(it);
  setBaseAnim('handsTogether');
}

export function bow(it: Interactable | null = null) {
  faceTo(it);
  playGesture('bow');
}

export function pray(eyesClosed: boolean, it: Interactable | null = null) {
  faceTo(it);
  setBaseAnim('pray', eyesClosed);
}

export function lightLamp() {
  const s = worldStore.get();
  const next = TEMPLE_LAMP_IDS.find((id) => !s.litLamps.includes(id));
  faceTo(s.nearby);
  playGesture('handsTogether');
  if (!next) {
    showToast('所有平安燈都已點亮', '願光明與平安一直陪伴你。');
    return;
  }
  worldStore.set({ litLamps: [...s.litLamps, next] });
  audio.playChime();
  showToast(pickOne(LAMP_BLESSINGS), '平安燈已點亮');
}

export function lightCandle() {
  const s = worldStore.get();
  const next = CHURCH_CANDLE_IDS.find((id) => !s.litCandles.includes(id));
  faceTo(s.nearby);
  playGesture('pray');
  if (!next) {
    showToast('燭台上的蠟燭都已點亮', '願溫暖的光一直陪伴你。');
    return;
  }
  worldStore.set({ litCandles: [...s.litCandles, next] });
  audio.playChime();
  showToast(pickOne(CANDLE_BLESSINGS), '祝福蠟燭已點亮');
}

export function ringBell(kind: 'temple' | 'church') {
  const s = worldStore.get();
  if (performance.now() - s.bellAt < 2500) return;
  faceTo(s.nearby);
  worldStore.set({ bellAt: performance.now() });
  if (kind === 'temple') audio.playTempleBell();
  else audio.playChurchBell();
}

export function startMeditation(minutes: number) {
  const d = minutes * 60_000;
  worldStore.set({ meditation: { duration: d, endAt: Date.now() + d, pausedLeft: null, done: false }, eyesClosed: true });
}

export function toggleMeditationPause() {
  const m = worldStore.get().meditation;
  if (!m) return;
  if (m.pausedLeft !== null) worldStore.set({ meditation: { ...m, endAt: Date.now() + m.pausedLeft, pausedLeft: null }, eyesClosed: true });
  else worldStore.set({ meditation: { ...m, pausedLeft: Math.max(0, m.endAt - Date.now()) }, eyesClosed: false });
}

export function finishMeditation(completed: boolean) {
  const s = worldStore.get();
  worldStore.set({ meditation: null, eyesClosed: s.baseAnim === 'meditate' ? false : s.eyesClosed });
  if (completed) {
    audio.playChime();
    showToast(MEDITATION_DONE);
  }
}

export function stopAll() {
  standUp();
}

/* ------------------------- Phase 4：山林探索與療癒 ------------------------- */

export function petCat() {
  const s = worldStore.get();
  faceTo(s.nearby);
  if (performance.now() - s.catPetAt < 4500) return;
  worldStore.set({ catPetAt: performance.now() });
  playGesture('happy');
  audio.playPurr();
  showToast('貓咪舒服地發出呼嚕聲', '摸摸');
}

export function feedFish() {
  const s = worldStore.get();
  faceTo(s.nearby);
  if (performance.now() - s.pondFeedAt < 3000) return;
  worldStore.set({ pondFeedAt: performance.now() });
  audio.playSplash();
}

export function hangWish(text: string) {
  const s = worldStore.get();
  faceTo(s.nearby);
  playGesture(s.scene === 'temple' ? 'handsTogether' : 'pray');
  worldStore.set({ wishes: [...s.wishes, text].slice(-12) });
  audio.playChime();
  showToast(`「${text}」`, '祝福已掛上祈願樹');
}

export function watchButterflies() {
  worldStore.set({ butterflyAt: performance.now() });
  playGesture('happy');
}

let leafId = 0;
/** 煩惱寄放所：文字只用於動畫，不保存、不上傳 */
export function releaseWorry(text: string) {
  const t = text.trim().slice(0, 60);
  if (!t) return;
  const id = ++leafId;
  worldStore.set({ leaves: [...worldStore.get().leaves, { id, text: t, at: performance.now() }] });
  playGesture('wave');
  window.setTimeout(() => {
    worldStore.set({ leaves: worldStore.get().leaves.filter((l) => l.id !== id) });
    showToast(WORRY_DONE);
  }, 7500);
}

/** 沿著小徑散步：自動走向下一個路點；按方向鍵或搖桿即停止 */
export function startWalk() {
  standUp();
  let best = 0;
  let bd = Infinity;
  WALK_PATH.forEach(([x, z], i) => {
    const d = Math.hypot(x - player.pos.x, z - player.pos.z);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  worldStore.set({ walking: true, walkIdx: best, moveTarget: WALK_PATH[best] });
}

export function stopWalk() {
  worldStore.set({ walking: false, moveTarget: null });
}
