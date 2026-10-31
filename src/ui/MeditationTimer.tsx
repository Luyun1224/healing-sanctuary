import { useEffect, useState } from 'react';
import * as A from '../world/actions';
import { useWorld, worldStore } from '../world/worldStore';

/** 靜坐計時器：呼吸圓環＋剩餘時間，可暫停或提前結束 */
export function MeditationTimer() {
  const m = useWorld((s) => s.meditation);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!m) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      const cur = worldStore.get().meditation;
      if (cur && cur.pausedLeft === null && Date.now() >= cur.endAt) A.finishMeditation(true);
    }, 250);
    return () => window.clearInterval(id);
  }, [m]);
  if (!m) return null;
  const left = Math.max(0, m.pausedLeft ?? m.endAt - now);
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const progress = 1 - left / m.duration;
  return (
    <div className="glass pointer-events-auto flex items-center gap-3 px-4 py-3">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
          <circle cx="28" cy="28" r="25" fill="none" stroke="#e7e2d6" strokeWidth="4" />
          <circle cx="28" cy="28" r="25" fill="none" stroke="#3f6b4a" strokeWidth="4" strokeDasharray={157} strokeDashoffset={157 * (1 - progress)} strokeLinecap="round" />
        </svg>
        <div className={`absolute inset-3 rounded-full bg-sage/60 ${m.pausedLeft === null ? 'breath' : ''}`} />
      </div>
      <div>
        <p className="text-xs text-stone-500">{m.pausedLeft === null ? '靜坐中・吸氣、吐氣' : '已暫停'}</p>
        <p className="font-mono text-xl font-bold text-forest">
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <button type="button" className="btn-soft !py-1 text-xs" onClick={A.toggleMeditationPause}>
          {m.pausedLeft === null ? '暫停' : '繼續'}
        </button>
        <button type="button" className="btn-soft !py-1 text-xs" onClick={() => A.finishMeditation(false)}>
          結束
        </button>
      </div>
    </div>
  );
}
