import type { SceneId } from '../config/scenes';
import * as A from '../world/actions';
import { LAYOUTS } from '../world/WorldCanvas';
import { playGesture, useWorld } from '../world/worldStore';

/** 下方角色動作快捷列 */
export function ActionBar({ scene, compact }: { scene: Exclude<SceneId, 'taoist'>; compact: boolean }) {
  const base = useWorld((s) => s.baseAnim);
  const seated = useWorld((s) => !!s.seat);
  const layout = LAYOUTS[scene];
  const items: { label: string; icon: string; on: () => void; active?: boolean }[] = [
    { label: '揮手', icon: '👋', on: () => playGesture('wave') },
    { label: '開心', icon: '😊', on: () => playGesture('happy') },
    { label: '鞠躬', icon: '🙇', on: () => A.bow() },
    scene === 'temple'
      ? { label: '合掌', icon: '🙏', on: () => A.handsTogether(), active: base === 'handsTogether' }
      : { label: '禱告', icon: '🤲', on: () => A.pray(false), active: base === 'pray' },
    { label: '坐下', icon: '🪑', on: () => A.sitOnGround(layout, false), active: seated && base === 'sit' },
    scene === 'temple'
      ? { label: '靜坐', icon: '🧘', on: () => A.sitOnGround(layout, true), active: base === 'meditate' }
      : { label: '默禱', icon: '🕯️', on: () => A.pray(true), active: base === 'pray' },
  ];
  const showStop = seated || base !== 'idle';
  return (
    <div className="glass pointer-events-auto flex items-center gap-1 px-2 py-1.5">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.on}
          className={`flex flex-col items-center rounded-xl px-2 py-1 text-[11px] font-medium transition hover:bg-white active:scale-95 ${it.active ? 'bg-forest/15 text-forest' : 'text-stone-600'}`}
          aria-label={it.label}
        >
          <span className="text-lg leading-none" aria-hidden>
            {it.icon}
          </span>
          {!compact && <span className="mt-0.5">{it.label}</span>}
        </button>
      ))}
      {showStop && (
        <button type="button" onClick={A.stopAll} className="ml-1 rounded-xl bg-stone-700/80 px-3 py-2 text-xs font-medium text-white">
          起身
        </button>
      )}
    </div>
  );
}
