import { useEffect, useState, type ReactNode } from 'react';
import { dailyMessage } from '../data/blessings';
import { WISHES } from '../data/healing';
import { useNet } from '../net/netStore';
import { BLESSING_MAX, postBlessing, refreshBlessings, useBlessings } from '../net/blessings';
import { loadProfile } from '../data/avatar';
import { showToast } from '../world/worldStore';
import type { SceneId } from '../config/scenes';
import * as A from '../world/actions';
import { TEMPLE_LAMP_IDS } from '../world/layouts/temple';
import { CHURCH_CANDLE_IDS } from '../world/layouts/church';
import { settingsStore, useSettings, audioStore } from '../world/settings';
import { useWorld, worldStore } from '../world/worldStore';
import type { Interactable } from '../world/types';

function Btn({ children, onClick, primary, active }: { children: ReactNode; onClick: () => void; primary?: boolean; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={primary ? 'btn-primary' : `btn-soft ${active ? 'ring-2 ring-forest/60' : ''}`}>
      {children}
    </button>
  );
}

const HINT: Partial<Record<Interactable['kind'], string>> = {
  fish: '輕輕敲幾下，讓心跟著節奏慢下來。敲擊次數只有你自己看得到，沒有排名。',
  buddha: '在佛像前合掌或鞠躬，靜靜停留一會兒。',
  cushion: '坐上蒲團，選擇靜坐時間，跟著呼吸放鬆。',
  lamp: '點一盞平安燈，為自己或掛念的人祝福。',
  templeBell: '輕敲一聲鐘，聽聲音在山谷裡慢慢散開。',
  churchBell: '拉動鐘繩，讓鐘聲在山谷中迴盪。',
  pew: '在長椅坐下，安靜禱告或只是休息。',
  altar: '在祭壇前雙手交握，靜靜禱告。',
  candles: '點亮一支祝福蠟燭。',
  piano: '坐在一旁，聽一段柔和的原創器樂。',
  board: '看看今天的祝福。',
  bench: '坐下來，看看山、聽聽風。',
  pavilion: '在涼亭坐下，遠眺瀑布與山景。',
  waterfall: '坐在溪邊，靜靜欣賞瀑布。',
  cat: '一隻正在曬太陽的貓咪，輕輕摸摸牠吧。',
  pond: '撒一點飼料，看錦鯉游過來。',
  wishTree: '選一句祝福，掛在祈願樹上（只存在你的畫面中）。',
  flowers: '花開得正好，蝴蝶也來了。',
  offering: '投下一枚祝福（虛擬，不涉及金錢），寫下一段話留給大家。不需要登入。',
};

export function InteractionPanel({ scene }: { scene: SceneId }) {
  const it = useWorld((s) => s.nearby);
  const seatId = useWorld((s) => s.seat?.id);
  const base = useWorld((s) => s.baseAnim);
  const eyes = useWorld((s) => s.eyesClosed);
  const fishAuto = useWorld((s) => s.fishAuto);
  const fishCount = useWorld((s) => s.fishCount);
  const lamps = useWorld((s) => s.litLamps.length);
  const candles = useWorld((s) => s.litCandles.length);
  const meditating = useWorld((s) => !!s.meditation);
  const track = useWorld((s) => s.track);
  const fishVol = useSettings((s) => s.fish);
  const sound = audioStore.useStore((s) => s.enabled);
  const [reading, setReading] = useState(false);
  const [wall, setWall] = useState(false);
  const daily = useNet((s) => s.daily);

  if (!it) return null;
  const seated = seatId === it.id;
  const busy = seated || base !== 'idle';

  let body: ReactNode = null;
  switch (it.kind) {
    case 'fish':
      body = (
        <>
          <div className="flex flex-wrap gap-2">
            <Btn primary onClick={A.strike}>敲木魚</Btn>
            <Btn active={fishAuto} onClick={() => A.setFishAuto(!fishAuto)}>
              {fishAuto ? '停止自動' : '自動慢敲（每秒一次）'}
            </Btn>
            {busy && <Btn onClick={A.stopAll}>停止並起身</Btn>}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-stone-600">
            <span>累計 {fishCount} 下（只存在你的瀏覽器）</span>
            <label className="flex flex-1 items-center gap-2">
              木魚音量
              <input type="range" min={0} max={1} step={0.05} value={fishVol} onChange={(e) => settingsStore.set({ fish: Number(e.target.value) })} className="w-24 accent-forest" />
            </label>
          </div>
        </>
      );
      break;
    case 'buddha':
      body = (
        <div className="flex flex-wrap gap-2">
          <Btn primary onClick={() => A.handsTogether(it)}>合掌</Btn>
          <Btn onClick={() => A.bow(it)}>鞠躬</Btn>
          {busy && <Btn onClick={A.stopAll}>放下雙手</Btn>}
        </div>
      );
      break;
    case 'cushion':
      body = seated ? (
        <div className="flex flex-wrap items-center gap-2">
          {!meditating && (
            <>
              <span className="text-xs text-stone-600">靜坐時間：</span>
              {[1, 3, 5, 10].map((m) => (
                <Btn key={m} primary={m === 3} onClick={() => A.startMeditation(m)}>
                  {m} 分鐘
                </Btn>
              ))}
            </>
          )}
          <Btn onClick={A.stopAll}>起身</Btn>
        </div>
      ) : (
        <Btn primary onClick={() => A.sitOn(it)}>坐上蒲團</Btn>
      );
      break;
    case 'lamp':
      body = (
        <div className="flex flex-wrap items-center gap-2">
          <Btn primary onClick={A.lightLamp}>點一盞平安燈</Btn>
          <span className="text-xs text-stone-600">
            已點亮 {lamps} / {TEMPLE_LAMP_IDS.length}
          </span>
        </div>
      );
      break;
    case 'templeBell':
      body = <Btn primary onClick={() => A.ringBell('temple')}>輕敲寺院鐘</Btn>;
      break;
    case 'churchBell':
      body = <Btn primary onClick={() => A.ringBell('church')}>拉動鐘繩</Btn>;
      break;
    case 'pew':
      body = seated ? (
        <div className="flex flex-wrap gap-2">
          <Btn primary active={base === 'pray' && !eyes} onClick={() => A.pray(false)}>雙手交握禱告</Btn>
          <Btn active={base === 'pray' && eyes} onClick={() => A.pray(true)}>閉眼默禱</Btn>
          {base === 'pray' && <Btn onClick={() => A.sitOn(it)}>放鬆坐著</Btn>}
          <Btn onClick={A.stopAll}>起身</Btn>
        </div>
      ) : (
        <Btn primary onClick={() => A.sitOn(it)}>在長椅坐下</Btn>
      );
      break;
    case 'altar':
      body = (
        <div className="flex flex-wrap gap-2">
          <Btn primary onClick={() => A.pray(false, it)}>雙手交握禱告</Btn>
          <Btn onClick={() => A.pray(true, it)}>閉眼默禱</Btn>
          <Btn onClick={() => A.bow(it)}>鞠躬</Btn>
          {busy && <Btn onClick={A.stopAll}>結束</Btn>}
        </div>
      );
      break;
    case 'candles':
      body = (
        <div className="flex flex-wrap items-center gap-2">
          <Btn primary onClick={A.lightCandle}>點亮祝福蠟燭</Btn>
          <span className="text-xs text-stone-600">
            已點亮 {candles} / {CHURCH_CANDLE_IDS.length}
          </span>
        </div>
      );
      break;
    case 'piano':
      body = (
        <div className="flex flex-wrap items-center gap-2">
          <Btn primary active={track === 'piano'} onClick={() => worldStore.set({ track: 'piano' })}>柔和鋼琴</Btn>
          <Btn active={track === 'organ'} onClick={() => worldStore.set({ track: 'organ' })}>管風琴和聲</Btn>
          {track && <Btn onClick={() => worldStore.set({ track: null })}>停止音樂</Btn>}
          {!sound && <span className="text-xs text-amber-700">請先點右上角「開啟聲音」</span>}
        </div>
      );
      break;
    case 'board':
      body = <Btn primary onClick={() => setReading(true)}>閱讀今日祝福</Btn>;
      break;
    case 'cat':
      body = <Btn primary onClick={A.petCat}>摸摸貓咪</Btn>;
      break;
    case 'pond':
      body = <Btn primary onClick={A.feedFish}>撒飼料餵魚</Btn>;
      break;
    case 'wishTree':
      body = (
        <div className="flex flex-wrap gap-1.5">
          {WISHES.map((w) => (
            <button key={w} type="button" className="chip border-stone-200 bg-white/80 text-stone-700" onClick={() => A.hangWish(w)}>
              {w}
            </button>
          ))}
        </div>
      );
      break;
    case 'offering':
      body = <OfferingPanel scene={scene === 'church' ? 'church' : 'temple'} key={it.id} onRead={() => setWall(true)} />;
      break;
    case 'flowers':
      body = <Btn primary onClick={A.watchButterflies}>欣賞蝴蝶</Btn>;
      break;
    case 'bench':
    case 'pavilion':
    case 'waterfall':
      body = seated ? <Btn onClick={A.stopAll}>起身</Btn> : <Btn primary onClick={() => A.sitOn(it)}>{it.kind === 'waterfall' ? '坐下欣賞水景' : '坐下放空'}</Btn>;
      break;
  }

  return (
    <>
      <div className="glass pointer-events-auto w-[min(94vw,460px)] animate-fade-up px-4 py-3">
        <p className="text-sm font-bold text-forest">{it.label}</p>
        <p className="mb-2 text-xs text-stone-500">{HINT[it.kind]}</p>
        {body}
      </div>
      {wall && <WallList scene={scene === 'church' ? 'church' : 'temple'} onClose={() => setWall(false)} />}
      {reading && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/25 p-6" onClick={() => setReading(false)}>
          <div className="glass max-w-sm animate-fade-up p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-xs font-medium text-forest/80">今日祝福</p>
            <p className="text-lg font-bold leading-relaxed">{daily ? daily.content : dailyMessage(scene === 'temple' ? 'temple' : 'church')}</p>
            <p className="mt-3 text-[11px] text-stone-500">{daily ? `— ${daily.author}` : '網站內建的原創祝福短句'}</p>
            <button type="button" className="btn-primary mt-4" onClick={() => setReading(false)}>
              謝謝
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** 投下祝福 → 寫下留言 */
function OfferingPanel({ scene, onRead }: { scene: 'temple' | 'church'; onRead: () => void }) {
  const [offered, setOffered] = useState(false);
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [sending, setSending] = useState(false);
  const nickname = loadProfile(scene)?.nickname ?? '';
  const count = useBlessings((s) => s.list.length);
  if (!offered)
    return (
      <div className="flex flex-wrap gap-2">
        <Btn
          primary
          onClick={() => {
            A.makeOffering();
            setOffered(true);
          }}
        >
          {scene === 'temple' ? '投下祝福・寫下祈願' : '投下祝福・寫下祝福'}
        </Btn>
        <Btn onClick={onRead}>看看大家的祝福{count ? `（${count}）` : ''}</Btn>
      </div>
    );
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        maxLength={BLESSING_MAX}
        onChange={(e) => setText(e.target.value)}
        className="h-16 w-full rounded-xl border border-stone-300 bg-white p-2 text-sm outline-none focus:border-forest"
        placeholder={scene === 'temple' ? '例如：願家人平安健康，願大家今天都順順利利。' : '例如：願每一位辛苦的同事都被溫柔接住。'}
      />
      <p className="text-[11px] leading-relaxed text-amber-800">留言會公開給所有人看見，請勿寫下真實姓名、病人或任何個人資料。</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-stone-600">
          <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} className="accent-forest" />
          匿名（不顯示暱稱「{nickname}」）
        </label>
        <span className="ml-auto text-xs text-stone-400">
          {Array.from(text).length}/{BLESSING_MAX}
        </span>
      </div>
      <div className="flex gap-2">
        <Btn
          primary
          onClick={async () => {
            if (sending || Array.from(text.trim()).length < 2) return showToast('請寫下 2～60 個字的祝福');
            setSending(true);
            const err = await postBlessing(scene, anon ? '匿名' : nickname, text);
            setSending(false);
            if (err) return showToast(err);
            showToast('你的祝福已經貼上留言板', '謝謝你的祝福');
            setText('');
            setOffered(false);
          }}
        >
          {sending ? '送出中…' : '貼上留言板'}
        </Btn>
        <Btn onClick={onRead}>看看大家的祝福</Btn>
      </div>
    </div>
  );
}

function WallList({ scene, onClose }: { scene: 'temple' | 'church'; onClose: () => void }) {
  const list = useBlessings((s) => s.list);
  const status = useBlessings((s) => s.status);
  useEffect(() => {
    void refreshBlessings(scene);
  }, [scene]);
  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/25 p-4" onClick={onClose}>
      <div className="glass flex max-h-[80vh] w-[min(94vw,520px)] animate-fade-up flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold text-forest">{scene === 'temple' ? '祈福留言板' : '祝福留言牆'}</p>
          <button type="button" className="text-sm text-stone-500" onClick={onClose}>
            關閉
          </button>
        </div>
        {status === 'offline' && <p className="mb-2 text-xs text-amber-700">暫時無法連線，以下為上次看到的留言。</p>}
        <div className="grid grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          {list.map((b, i) => (
            <div key={b.id} className="rounded-xl p-3 text-sm shadow-sm" style={{ background: ['#fff6c8', '#ffe1e6', '#e3f1dc', '#e2ecf8'][i % 4] }}>
              <p className="leading-relaxed">{b.content}</p>
              <p className="mt-1 text-right text-[11px] text-stone-500">— {b.nickname}</p>
            </div>
          ))}
          {!list.length && <p className="text-sm text-stone-500">{status === 'loading' ? '讀取中…' : '還沒有留言，留下第一句祝福吧。'}</p>}
        </div>
      </div>
    </div>
  );
}
