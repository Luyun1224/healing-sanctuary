import { useState } from 'react';
import { netStore, remotes, useNet } from '../net/netStore';
import { PRESETS } from '../net/presets';
import { sync } from '../net/sync';
import { player, showToast } from '../world/worldStore';

/** 溫暖互動：揮手、合掌、祝福短語（不開放自由文字聊天） */
export function Greetings({ onClose }: { onClose: () => void }) {
  const focus = useNet((s) => s.focusMode);
  const [busy, setBusy] = useState(false);
  const nearest = () => {
    let best: string | undefined;
    let bd = 4;
    for (const r of remotes.values()) {
      const d = r.pos.distanceTo(player.pos);
      if (d < bd) {
        bd = d;
        best = r.id;
      }
    }
    return best;
  };
  const target = nearest();
  return (
    <div className="glass pointer-events-auto w-[min(94vw,420px)] animate-fade-up p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-forest">打個招呼{target ? `・對 ${remotes.get(target)?.nickname}` : ''}</p>
        <button type="button" className="text-xs text-stone-500" onClick={onClose}>
          關閉
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={busy}
            className="btn-soft border border-stone-200 !px-2.5 !py-1.5"
            onClick={async () => {
              setBusy(true);
              const err = await sync.interact(p.id, nearest());
              setBusy(false);
              if (err) showToast(err);
              else onClose();
            }}
          >
            {p.label === p.text ? p.text : `${p.text} ${p.label}`}
          </button>
        ))}
      </div>
      <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 border-t border-stone-200 pt-2 text-sm">
        <span>
          專注靜心模式
          <span className="block text-xs text-stone-500">不顯示其他人的對話泡泡與互動通知</span>
        </span>
        <input type="checkbox" checked={focus} onChange={(e) => netStore.set({ focusMode: e.target.checked, bubbles: e.target.checked ? [] : netStore.get().bubbles })} className="h-4 w-4 accent-forest" />
      </label>
    </div>
  );
}
