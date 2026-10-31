import * as THREE from 'three';
import type { SceneId } from '../config/scenes';
import type { PlayerProfile } from '../data/avatar';
import type { Anim } from '../world/types';
import { player, playGesture, showToast, worldStore } from '../world/worldStore';
import { beaconGas, callGas, GAS_URL } from './api';
import { addBubble, netStore, remotes, type RemotePlayer } from './netStore';
import { INTERACT_COOLDOWN_MS, presetById, type PresetId } from './presets';

/**
 * 多人同步客戶端
 * 本機移動完全不等待網路；每 5～10 秒（依伺服器建議）合併送出：自己的位置與動作、心跳、讀取房間狀態。
 * - 狀態沒變時不送位置，只在 25 秒心跳到期時送 hb。
 * - 分頁在背景時只送心跳、不讀取。
 * - 連線失敗以指數退避重試；連續失敗時顯示「暫時無法取得在線狀態」，單人功能不受影響。
 */
interface WireState {
  x: number;
  y: number;
  z: number;
  r: number;
  a: Anim;
  e: boolean;
  q: '' | 's' | 'm';
}
interface WirePlayer {
  h?: string;
  id: string;
  n: string;
  av: RemotePlayer['avatar'];
  s: WireState;
  seen: number;
  v: number;
}
interface WireEvent {
  minutes?: number;
  startAt?: number;
  seq: number;
  from: string;
  to: string;
  preset: string;
  at: number;
}
interface Snapshot {
  online: number;
  players: WirePlayer[];
  events: WireEvent[];
  interval: number;
}
interface Room {
  roomId: string;
  scene: string;
  name: string;
  capacity: number;
}

const HEARTBEAT_MS = 25_000;
export const hostKeyName = (scene: SceneId | null) => `healing-sanctuary:hostKey:${scene}`;
const MAX_BACKOFF_MS = 60_000;

function localState(): WireState {
  const s = worldStore.get();
  let a: Anim = s.baseAnim;
  if (s.gesture && performance.now() < s.gesture.until) a = s.gesture.anim;
  if (player.moving) a = 'walk';
  const r2 = (v: number) => Math.round(v * 20) / 20;
  return {
    x: r2(player.pos.x),
    y: r2(player.pos.y),
    z: r2(player.pos.z),
    r: Math.round(player.rot * 10) / 10,
    a,
    e: s.eyesClosed,
    q: s.seat && !player.moving ? (s.seat.pose === 'meditate' ? 'm' : 's') : '',
  };
}

class SyncClient {
  private scene: SceneId | null = null;
  private profile: PlayerProfile | null = null;
  private room: Room | null = null;
  private playerId = '';
  private token = '';
  private sinceEvent = -1;
  private timer: number | null = null;
  private failures = 0;
  private lastSent = '';
  private lastHb = 0;
  private interval = 6000;
  private running = false;
  private inFlight = false;
  private lastInteract = 0;
  /** 每次 start/stop 遞增；過期的非同步回應一律丟棄 */
  private gen = 0;

  get enabled() {
    return !!GAS_URL;
  }

  start(scene: SceneId, profile: PlayerProfile) {
    this.stop(false);
    this.scene = scene;
    this.profile = profile;
    this.running = true;
    if (!GAS_URL) {
      netStore.set({ status: 'disabled', online: 0 });
      return;
    }
    netStore.set({ status: 'connecting', online: 0, ids: [], bubbles: [] });
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    void this.join();
  }

  stop(leave = true) {
    this.gen++;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    if (leave && this.room && this.token) {
      void callGas('leaveRoom', { roomId: this.room.roomId, playerId: this.playerId, token: this.token }, 5000);
      sessionStorage.removeItem(this.sessionKey());
    }
    this.running = false;
    this.room = null;
    this.token = '';
    this.playerId = '';
    remotes.clear();
    netStore.set({ ids: [], online: 0, bubbles: [], selfId: '', hostRole: '', invite: null });
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
  }

  private sessionKey() {
    return `healing-sanctuary:net:${this.scene}`;
  }

  private schedule(ms: number) {
    if (!this.running) return;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.tick(), ms);
  }

  private onVisibility = () => {
    if (document.visibilityState === 'visible' && this.room) this.schedule(200);
  };

  private onPageHide = () => {
    if (this.room && this.token) beaconGas('leaveRoom', { roomId: this.room.roomId, playerId: this.playerId, token: this.token });
  };

  private fail(error: string, retryAfter?: number) {
    this.failures++;
    if (error === 'room_full') netStore.set({ status: 'full' });
    else if (this.failures >= 2 || !this.room) netStore.set({ status: 'offline' });
    // 長時間無法同步：其他玩家的資料已不可信，先移除，避免看到「卡住」的角色
    const lastOk = netStore.get().lastOkAt;
    if (remotes.size && (!lastOk || Date.now() - lastOk > 90_000)) {
      remotes.clear();
      netStore.set({ ids: [] });
    }
    const wait = retryAfter ?? Math.min(MAX_BACKOFF_MS, this.interval * Math.pow(2, this.failures));
    return wait;
  }

  private async join(): Promise<void> {
    if (!this.scene || !this.profile) return;
    const gen = this.gen;
    const rooms = await callGas<{ rooms: Room[] }>('getRooms');
    if (gen !== this.gen) return;
    if (!rooms.ok) return this.schedule(this.fail(rooms.error));
    const candidates = rooms.rooms.filter((r) => r.scene === this.scene);
    if (!candidates.length) {
      netStore.set({ status: 'offline' });
      return;
    }
    let saved: { roomId: string; playerId: string; token: string } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(this.sessionKey()) || 'null');
    } catch {
      saved = null;
    }
    let lastError = 'room_full';
    for (const room of candidates) {
      const resume = saved && saved.roomId === room.roomId ? { playerId: saved.playerId, token: saved.token } : {};
      const hostKey = sessionStorage.getItem(hostKeyName(this.scene)) || undefined;
      const res = await callGas<Snapshot & { playerId: string; token: string; room: Room; hostRole?: string }>('joinRoom', {
        roomId: room.roomId,
        nickname: this.profile.nickname,
        avatar: this.profile.avatar,
        state: localState(),
        hostKey,
        ...resume,
      });
      if (!res.ok && res.error === 'bad_host_key') {
        // 金鑰錯誤或已被停用：移除後以一般身分重新加入
        sessionStorage.removeItem(hostKeyName(this.scene));
        showToast('主持人金鑰無效或已停用，已改以一般身分進入');
        return this.join();
      }
      if (gen !== this.gen) {
        // 已離開場景：把剛建立的玩家移除，避免留下分身
        if (res.ok) void callGas('leaveRoom', { roomId: res.room.roomId, playerId: res.playerId, token: res.token }, 5000);
        return;
      }
      if (res.ok) {
        this.room = res.room;
        this.playerId = res.playerId;
        this.token = res.token;
        this.failures = 0;
        this.lastHb = Date.now();
        sessionStorage.setItem(this.sessionKey(), JSON.stringify({ roomId: room.roomId, playerId: res.playerId, token: res.token }));
        netStore.set({ roomName: res.room.name, selfId: res.playerId, hostRole: res.hostRole || '' });
        if (hostKey && res.hostRole) showToast(`今天由你擔任${res.hostRole}，謝謝你的陪伴`, '主持人已登入');
        void this.loadContent();
        // 加入前的舊事件不顯示
        this.sinceEvent = res.events.reduce((m, e) => Math.max(m, e.seq), 0);
        this.apply(res, true);
        return this.schedule(this.interval);
      }
      lastError = res.error;
      if (res.error !== 'room_full') break;
    }
    this.schedule(this.fail(lastError, lastError === 'room_full' ? 30_000 : undefined));
  }

  private async tick() {
    if (!this.running) return;
    if (!this.room) return void this.join();
    if (this.inFlight) return this.schedule(1000);
    const hidden = document.visibilityState === 'hidden';
    const now = Date.now();
    const st = localState();
    const key = JSON.stringify(st);
    const changed = key !== this.lastSent;
    const hbDue = now - this.lastHb > HEARTBEAT_MS;
    if (hidden && !hbDue) return this.schedule(Math.max(1000, HEARTBEAT_MS - (now - this.lastHb)));

    this.inFlight = true;
    const gen = this.gen;
    const res = await callGas<Snapshot>('syncRoomState', {
      roomId: this.room.roomId,
      playerId: this.playerId,
      token: this.token,
      state: changed ? st : undefined,
      hb: hbDue || undefined,
      sinceEvent: this.sinceEvent,
    });
    this.inFlight = false;
    if (gen !== this.gen || !this.running) return;
    if (res.ok) {
      if (changed) this.lastSent = key;
      if (changed || hbDue) this.lastHb = now;
      this.failures = 0;
      this.apply(res, false);
      return this.schedule(hidden ? HEARTBEAT_MS : this.interval);
    }
    if (res.error === 'expired' || res.error === 'invalid_token') {
      // 伺服器端狀態遺失（逾時或快取被清除）：重新加入
      sessionStorage.removeItem(this.sessionKey());
      this.room = null;
      this.lastSent = '';
      return this.schedule(500);
    }
    if (res.error === 'too_frequent' || res.error === 'busy') return this.schedule(res.retryAfter ?? 3000);
    this.schedule(this.fail(res.error));
  }

  private apply(snap: Snapshot, initial: boolean) {
    this.interval = Math.max(5000, Math.min(20000, snap.interval || 6000));
    const now = performance.now();
    const seen = new Set<string>();
    for (const p of snap.players) {
      seen.add(p.id);
      const r = remotes.get(p.id);
      if (!r) {
        const pos = new THREE.Vector3(p.s.x, p.s.y, p.s.z);
        remotes.set(p.id, {
          id: p.id,
          nickname: p.n,
          avatar: p.av,
          target: pos.clone(),
          pos,
          rot: p.s.r,
          targetRot: p.s.r,
          anim: p.s.a,
          eyesClosed: p.s.e,
          seated: p.s.q,
          role: p.h || '',
          receivedAt: now,
          version: p.v,
          gesture: null,
          speed: 2,
        });
        continue;
      }
      r.nickname = p.n;
      r.avatar = p.av;
      r.role = p.h || '';
      if (p.v !== r.version) {
        r.version = p.v;
        r.target.set(p.s.x, p.s.y, p.s.z);
        r.targetRot = p.s.r;
        r.anim = p.s.a;
        r.eyesClosed = p.s.e;
        r.seated = p.s.q;
        // 讓角色大約在下一次更新前抵達新位置
        const d = r.pos.distanceTo(r.target);
        r.speed = THREE.MathUtils.clamp(d / (this.interval / 1000), 1.2, 4.5);
        r.receivedAt = now;
      }
    }
    for (const id of [...remotes.keys()]) if (!seen.has(id)) remotes.delete(id);
    const ids = [...remotes.keys()].sort();
    const prev = netStore.get().ids;
    netStore.set({
      status: 'online',
      online: snap.online,
      interval: this.interval,
      lastOkAt: Date.now(),
      ids: prev.length === ids.length && prev.every((v, i) => v === ids[i]) ? prev : ids,
    });
    if (!initial) {
      for (const e of snap.events) {
        this.sinceEvent = Math.max(this.sinceEvent, e.seq);
        if (e.from === this.playerId) continue;
        if (e.preset === 'invite') {
          const host = remotes.get(e.from);
          if (!netStore.get().focusMode) netStore.set({ invite: { id: e.seq, nickname: host?.nickname ?? '值日陪伴員', role: host?.role || '值日陪伴員', minutes: e.minutes ?? 3, startAt: e.startAt ?? Date.now() } });
          continue;
        }
        const preset = presetById(e.preset);
        const r = remotes.get(e.from);
        if (!preset || !r) continue;
        r.gesture = { anim: preset.anim as Anim, until: now + 2500 };
        if (!netStore.get().focusMode) addBubble(e.from, preset.text);
      }
    }
  }

  /** 讀取每日一句與公告（由後台發布；沒有時前端使用內建內容） */
  private async loadContent() {
    if (!this.scene) return;
    const [d, a] = await Promise.all([
      callGas<{ message: { content: string; author: string } | null }>('getDailyMessage', { scene: this.scene }),
      callGas<{ announcements: { id: string; content: string }[] }>('getAnnouncements', { scene: this.scene }),
    ]);
    netStore.set({ daily: d.ok ? d.message : null, announcements: a.ok ? a.announcements : [] });
  }

  /** 主持人：重新以主持人身分加入（金鑰只存在此分頁的 sessionStorage） */
  restart() {
    if (this.scene && this.profile) this.start(this.scene, this.profile);
  }

  /** 主持人：發送集體靜心邀請 */
  async invite(minutes: number): Promise<string | null> {
    if (!this.room) return '目前未連線';
    const res = await callGas('sendInvitation', { roomId: this.room.roomId, playerId: this.playerId, token: this.token, minutes });
    if (res.ok) return null;
    if (res.error === 'cooldown') return '5 分鐘內只能發送一次邀請';
    if (res.error === 'not_host') return '只有主持人可以發送邀請';
    return '暫時無法發送，請稍後再試';
  }

  /** 送出預設互動；本機立即顯示，伺服器端也有冷卻限制 */
  async interact(id: PresetId, targetId?: string): Promise<string | null> {
    const now = Date.now();
    if (now - this.lastInteract < INTERACT_COOLDOWN_MS) return `請稍候 ${Math.ceil((INTERACT_COOLDOWN_MS - (now - this.lastInteract)) / 1000)} 秒再互動`;
    const preset = presetById(id);
    if (!preset) return null;
    this.lastInteract = now;
    playGesture(preset.anim as Anim);
    addBubble('self', preset.text);
    if (!this.room) return null;
    const res = await callGas('sendPresetInteraction', { roomId: this.room.roomId, playerId: this.playerId, token: this.token, preset: id, targetId });
    if (!res.ok && res.error === 'cooldown') return '互動太頻繁了，休息一下再試';
    return null;
  }
}

export const sync = new SyncClient();
