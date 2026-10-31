import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SceneId } from '../config/scenes';
import { loadProfile } from '../data/avatar';
import { BREATH_PACES, MOODS, drawCard } from '../data/healing';
import { callGas } from '../net/api';
import { netStore, useNet } from '../net/netStore';
import { hostKeyName, sync } from '../net/sync';
import * as A from '../world/actions';
import { showToast, useWorld } from '../world/worldStore';

type Scene = Exclude<SceneId, 'taoist'>;
export type HealingView = 'menu' | 'breath' | 'worry' | 'mood' | 'card' | 'apply' | 'hostLogin' | 'hostTools' | null;

function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`glass pointer-events-auto max-h-[70vh] animate-fade-up overflow-y-auto p-4 ${wide ? 'w-[min(94vw,460px)]' : 'w-[min(94vw,380px)]'}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-bold text-forest">{title}</p>
        <button type="button" className="text-sm text-stone-500" onClick={onClose}>
          關閉
        </button>
      </div>
      {children}
    </div>
  );
}

/** 療癒選單與各項功能面板 */
export function HealingPanel({ view, setView, scene }: { view: HealingView; setView: (v: HealingView) => void; scene: Scene }) {
  const walking = useWorld((s) => s.walking);
  const hostRole = useNet((s) => s.hostRole);
  const online = useNet((s) => s.status === 'online');
  const close = () => setView(null);
  if (!view) return null;

  if (view === 'menu') {
    const items: { icon: string; label: string; sub: string; on: () => void }[] = [
      { icon: '🫧', label: '呼吸練習', sub: '跟著圓環慢慢吸氣、吐氣', on: () => setView('breath') },
      { icon: '🍃', label: '煩惱寄放所', sub: '寫下煩惱，讓它隨風離開', on: () => setView('worry') },
      { icon: '🌤️', label: '今日心情', sub: '只在你的裝置上，不會公開', on: () => setView('mood') },
      { icon: '🎴', label: '今日溫暖小語', sub: '抽一張給自己的小卡', on: () => setView('card') },
      walking
        ? { icon: '⏹️', label: '停止散步', sub: '回到自由走動', on: () => (A.stopWalk(), close()) }
        : { icon: '🚶', label: '沿著小徑散步', sub: '自動慢慢走一圈，按方向鍵即停止', on: () => (A.startWalk(), close()) },
      { icon: '🤝', label: '申請成為值日陪伴員', sub: '每日問候、陪大家休息', on: () => setView('apply') },
      hostRole
        ? { icon: '🔔', label: '主持人工具', sub: `目前身分：${hostRole}`, on: () => setView('hostTools') }
        : { icon: '🔑', label: '主持人登入', sub: '使用管理員核發的主持人金鑰', on: () => setView('hostLogin') },
    ];
    return (
      <Sheet title="🌿 療癒小角落" onClose={close}>
        <div className="grid grid-cols-1 gap-1.5">
          {items.map((it) => (
            <button key={it.label} type="button" onClick={it.on} className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2 text-left transition hover:bg-white">
              <span className="text-xl">{it.icon}</span>
              <span>
                <span className="block text-sm font-bold text-stone-700">{it.label}</span>
                <span className="block text-xs text-stone-500">{it.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    );
  }
  if (view === 'worry') return <Worry onClose={close} />;
  if (view === 'mood') return <Mood onClose={close} openBreath={() => setView('breath')} />;
  if (view === 'card') return <CardDraw onClose={close} scene={scene} />;
  if (view === 'apply') return <Apply onClose={close} scene={scene} online={online} />;
  if (view === 'hostLogin') return <HostLogin onClose={close} scene={scene} />;
  if (view === 'hostTools') return <HostTools onClose={close} />;
  return null;
}

function Worry({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  return (
    <Sheet title="🍃 煩惱寄放所" onClose={onClose}>
      <p className="mb-2 text-xs text-stone-500">寫下今天想暫時放下的事。內容不會保存、不會公開、也不會上傳。</p>
      <textarea
        value={text}
        maxLength={60}
        onChange={(e) => setText(e.target.value)}
        className="h-20 w-full rounded-xl border border-stone-300 bg-white p-2 text-sm outline-none focus:border-forest"
        placeholder="例如：今天的報告還沒寫完……"
      />
      <button
        type="button"
        className="btn-primary mt-2 w-full"
        disabled={!text.trim()}
        onClick={() => {
          A.releaseWorry(text);
          setText('');
          onClose();
        }}
      >
        讓煩惱隨風離開
      </button>
    </Sheet>
  );
}

function Mood({ onClose, openBreath }: { onClose: () => void; openBreath: () => void }) {
  const [pick, setPick] = useState<(typeof MOODS)[number] | null>(null);
  return (
    <Sheet title="🌤️ 今日心情" onClose={onClose}>
      {!pick ? (
        <>
          <p className="mb-2 text-xs text-stone-500">選擇只在你的裝置上處理，不會儲存或公開給任何人。</p>
          <div className="grid grid-cols-2 gap-1.5">
            {MOODS.map((m) => (
              <button key={m.id} type="button" onClick={() => setPick(m)} className="rounded-xl bg-white/80 px-2 py-3 text-sm hover:bg-white">
                <span className="mr-1 text-lg">{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="animate-fade-up text-center">
          <p className="text-3xl">{pick.emoji}</p>
          <p className="mt-2 leading-relaxed">{pick.reply}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-soft flex-1 border border-stone-200" onClick={() => setPick(null)}>
              重新選擇
            </button>
            {(pick.id === 'upset' || pick.id === 'tired') && (
              <button type="button" className="btn-primary flex-1" onClick={openBreath}>
                做個呼吸練習
              </button>
            )}
            {pick.id === 'quiet' && (
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => {
                  netStore.set({ focusMode: true, bubbles: [], invite: null });
                  showToast('已開啟專注靜心模式');
                  onClose();
                }}
              >
                開啟專注靜心模式
              </button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function CardDraw({ onClose, scene }: { onClose: () => void; scene: Scene }) {
  const [card, setCard] = useState<{ text: string; n: number } | null>(null);
  return (
    <Sheet title="🎴 今日溫暖小語" onClose={onClose}>
      <div className="flex flex-col items-center gap-3" style={{ perspective: 800 }}>
        {card ? (
          <div key={card.n} className="card-flip flex h-44 w-32 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-b from-[#fbf6ea] to-[#e7efe2] p-3 text-center text-sm font-bold leading-relaxed text-stone-700 shadow-soft">
            {card.text}
          </div>
        ) : (
          <div className="flex h-44 w-32 items-center justify-center rounded-2xl border-4 border-white bg-forest text-3xl text-white shadow-soft">🌿</div>
        )}
        <button type="button" className="btn-primary w-full" onClick={() => setCard({ text: drawCard(scene), n: (card?.n ?? 0) + 1 })}>
          {card ? '再抽一張' : '抽一張'}
        </button>
      </div>
    </Sheet>
  );
}

function Apply({ onClose, scene, online }: { onClose: () => void; scene: Scene; online: boolean }) {
  const [form, setForm] = useState({ nickname: loadProfile(scene)?.nickname ?? '', scene, requestedDate: new Date(Date.now() + 8 * 3600e3 + 86400e3).toISOString().slice(0, 10), introduction: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const submit = async () => {
    setState('sending');
    const res = await callGas<{ applicationId: string }>('submitHostApplication', form);
    if (res.ok) setState('done');
    else {
      setState('idle');
      showToast(res.error === 'invalid_date' ? '日期需在今天起 90 天內' : res.error === 'invalid' ? '請完整填寫（自我介紹至少 5 個字）' : '暫時無法送出，請稍後再試');
    }
  };
  if (state === 'done')
    return (
      <Sheet title="🤝 申請已送出" onClose={onClose}>
        <p className="leading-relaxed">謝謝你願意陪伴大家！管理員審核後，會私下提供「主持人金鑰」給你。</p>
      </Sheet>
    );
  return (
    <Sheet title="🤝 申請成為值日陪伴員" onClose={onClose}>
      <p className="mb-2 text-xs leading-relaxed text-stone-500">值日陪伴員負責每日問候、正向鼓勵與簡短陪伴，不是心理治療或宗教諮詢。正式宗教職稱（住持、神父、牧師）只提供給具相應身分或經授權者。</p>
      <div className="space-y-2 text-sm">
        <input className="w-full rounded-xl border border-stone-300 px-3 py-2" placeholder="暱稱" maxLength={12} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
        <div className="flex gap-2">
          <select className="flex-1 rounded-xl border border-stone-300 px-2 py-2" value={form.scene} onChange={(e) => setForm({ ...form, scene: e.target.value as Scene })}>
            <option value="temple">靜心佛堂</option>
            <option value="church">平安教堂</option>
          </select>
          <input type="date" className="flex-1 rounded-xl border border-stone-300 px-2 py-2" value={form.requestedDate} onChange={(e) => setForm({ ...form, requestedDate: e.target.value })} />
        </div>
        <textarea className="h-20 w-full rounded-xl border border-stone-300 p-2" maxLength={200} placeholder="簡短自我介紹（不需真實姓名）" value={form.introduction} onChange={(e) => setForm({ ...form, introduction: e.target.value })} />
        <button type="button" className="btn-primary w-full" disabled={state === 'sending' || !online} onClick={submit}>
          {state === 'sending' ? '送出中…' : '送出申請'}
        </button>
        {!online && <p className="text-xs text-amber-700">目前無法連線到伺服器，請稍後再試。</p>}
      </div>
    </Sheet>
  );
}

function HostLogin({ onClose, scene }: { onClose: () => void; scene: Scene }) {
  const [key, setKey] = useState('');
  return (
    <Sheet title="🔑 主持人登入" onClose={onClose}>
      <p className="mb-2 text-xs leading-relaxed text-stone-500">請貼上管理員核發的主持人金鑰。金鑰只會保存在這個瀏覽器分頁，關閉分頁後需重新輸入；共用電腦請記得關閉分頁。</p>
      <input className="w-full rounded-xl border border-stone-300 px-3 py-2 font-mono text-sm" value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
      <button
        type="button"
        className="btn-primary mt-2 w-full"
        disabled={key.length < 30}
        onClick={() => {
          sessionStorage.setItem(hostKeyName(scene), key);
          sync.restart();
          onClose();
        }}
      >
        登入
      </button>
    </Sheet>
  );
}

function HostTools({ onClose }: { onClose: () => void }) {
  const role = useNet((s) => s.hostRole);
  const daily = useNet((s) => s.daily);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={`🔔 ${role}工具`} onClose={onClose}>
      <p className="mb-2 text-sm">發送集體靜心邀請給同一房間的人（每 5 分鐘一次）。大家可自由選擇是否參加，不會被強制切換畫面或音樂。</p>
      <div className="flex gap-2">
        {[1, 3, 5].map((m) => (
          <button
            key={m}
            type="button"
            disabled={busy}
            className="btn-primary flex-1"
            onClick={async () => {
              setBusy(true);
              const err = await sync.invite(m);
              setBusy(false);
              showToast(err ?? `已邀請大家 30 秒後一起靜心 ${m} 分鐘`);
              if (!err) onClose();
            }}
          >
            {m} 分鐘
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-stone-500">今日一句：{daily ? `「${daily.content}」` : '尚未發布（可請管理員在後台發布，你靠近同事時會以對話泡泡顯示）'}</p>
      <button
        type="button"
        className="btn-soft mt-3 w-full border border-stone-200"
        onClick={() => {
          for (const k of Object.keys(sessionStorage)) if (k.startsWith('healing-sanctuary:hostKey:')) sessionStorage.removeItem(k);
          sync.restart();
          onClose();
        }}
      >
        登出主持人身分
      </button>
    </Sheet>
  );
}

/** 呼吸練習：圓環依節奏放大（吸氣）與縮小（吐氣），可暫停、換節奏、提前結束 */
export function Breathing({ minutes, startAt, onClose }: { minutes: number; startAt: number; onClose: () => void }) {
  const [pace, setPace] = useState<(typeof BREATH_PACES)[number]>(BREATH_PACES[0]);
  const [paused, setPaused] = useState(false);
  const [mins, setMins] = useState(minutes);
  const elapsed = useRef(0);
  const last = useRef(performance.now());
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      if (!paused && Date.now() >= startAt) elapsed.current += (now - last.current) / 1000;
      last.current = now;
      force((n) => n + 1);
      if (elapsed.current >= mins * 60) {
        showToast('做得很好。願你帶著平靜繼續今天。', '呼吸練習完成');
        onClose();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, mins, startAt, onClose]);

  const waiting = Date.now() < startAt;
  const cycle = pace.inhale + pace.hold + pace.exhale;
  const t = elapsed.current % cycle;
  let label = '吸氣';
  let scale = 0.55;
  if (t < pace.inhale) {
    scale = 0.55 + 0.45 * Math.sin(((t / pace.inhale) * Math.PI) / 2);
  } else if (t < pace.inhale + pace.hold) {
    label = '停留';
    scale = 1;
  } else {
    label = '吐氣';
    scale = 1 - 0.45 * Math.sin((((t - pace.inhale - pace.hold) / pace.exhale) * Math.PI) / 2);
  }
  const left = Math.max(0, mins * 60 - elapsed.current);
  return (
    <div className="glass pointer-events-auto flex w-[min(94vw,360px)] animate-fade-up flex-col items-center gap-3 p-4">
      <div className="relative flex h-44 w-44 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-sage/25" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#cfe3c8] to-[#9cb59a] shadow-soft" style={{ transform: `scale(${waiting ? 0.55 : scale})`, transition: 'transform 0.1s linear' }} />
        <div className="relative text-center">
          <p className="text-xl font-bold text-forest">{waiting ? `${Math.ceil((startAt - Date.now()) / 1000)} 秒後開始` : paused ? '暫停中' : label}</p>
          <p className="font-mono text-sm text-stone-600">
            {String(Math.floor(left / 60)).padStart(2, '0')}:{String(Math.floor(left % 60)).padStart(2, '0')}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {[1, 3, 5].map((m) => (
          <button key={m} type="button" onClick={() => setMins(m)} className={`chip ${mins === m ? 'border-forest bg-forest text-white' : 'border-stone-300 bg-white/70'}`}>
            {m} 分鐘
          </button>
        ))}
        {BREATH_PACES.map((p) => (
          <button key={p.id} type="button" onClick={() => setPace(p)} className={`chip ${pace.id === p.id ? 'border-forest bg-forest text-white' : 'border-stone-300 bg-white/70'}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex w-full gap-2">
        <button type="button" className="btn-soft flex-1 border border-stone-200" onClick={() => setPaused(!paused)}>
          {paused ? '繼續' : '暫停'}
        </button>
        <button type="button" className="btn-soft flex-1 border border-stone-200" onClick={onClose}>
          提前結束
        </button>
      </div>
    </div>
  );
}

/** 收到集體靜心邀請：自由選擇參加或略過 */
export function InviteCard({ onJoin }: { onJoin: (minutes: number, startAt: number) => void }) {
  const invite = useNet((s) => s.invite);
  if (!invite) return null;
  const dismiss = () => netStore.set({ invite: null });
  return (
    <div className="glass pointer-events-auto w-[min(94vw,380px)] animate-fade-up p-3">
      <p className="text-xs text-forest/80">
        {invite.role}・{invite.nickname}
      </p>
      <p className="font-bold">{invite.minutes} 分鐘靜心即將開始，歡迎一起休息。</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={() => {
            onJoin(invite.minutes, invite.startAt);
            dismiss();
          }}
        >
          一起參加
        </button>
        <button type="button" className="btn-soft flex-1 border border-stone-200" onClick={dismiss}>
          這次先不用
        </button>
      </div>
    </div>
  );
}
