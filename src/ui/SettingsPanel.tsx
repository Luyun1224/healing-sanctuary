import { PHASE_LABEL, type DayPhase } from '../lib/timeOfDay';
import { settingsStore, useSettings, type Settings } from '../world/settings';
import { useWorld, worldStore } from '../world/worldStore';
import type { SceneId } from '../config/scenes';
import { useEffect, useState } from 'react';
import { load, save } from '../lib/storage';
import { audio, type InteriorSource } from '../audio/engine';

function useInteriorSource(scene: 'temple' | 'church') {
  const [src, setSrc] = useState<InteriorSource>('none');
  useEffect(() => {
    audio.onInteriorSource = (sc, v) => {
      if (sc === scene) setSrc(v);
    };
    return () => {
      audio.onInteriorSource = null;
    };
  }, [scene]);
  return src;
}

function Slider({ label, k }: { label: string; k: keyof Pick<Settings, 'master' | 'nature' | 'music' | 'sfx' | 'fish' | 'chant'> }) {
  const v = useSettings((s) => s[k]);
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-20 shrink-0 text-stone-600">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={v} onChange={(e) => settingsStore.set({ [k]: Number(e.target.value) } as Partial<Settings>)} className="w-full accent-forest" />
    </label>
  );
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1 text-sm">
      <span>
        {label}
        {hint && <span className="block text-xs text-stone-500">{hint}</span>}
      </span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-forest" />
    </label>
  );
}

export function SoundPanel({ scene }: { scene: SceneId }) {
  const s = useSettings((x) => x);
  const track = useWorld((x) => x.track);
  const sceneTrack = scene === 'temple' ? 'zen' : 'garden';
  const interiorSrc = useInteriorSource(scene === 'church' ? 'church' : 'temple');
  return (
    <div className="space-y-2">
      <Slider label="總音量" k="master" />
      <Slider label="蟲鳴鳥叫" k="nature" />
      <Slider label={scene === 'temple' ? '佛堂誦唱' : '教堂詩班'} k="chant" />
      <Slider label="背景音樂" k="music" />
      <Slider label="互動音效" k="sfx" />
      {scene === 'temple' && <Slider label="木魚音量" k="fish" />}
      <Toggle
        label={scene === 'temple' ? '進入佛堂自動播放誦唱、木魚與頌缽' : '進入教堂自動播放詩班、琴聲與鐘聲'}
        hint={interiorSrc === 'recording' ? '目前播放授權錄音' : '目前為合成氛圍音（只有母音，非真實經文或聖詩錄音）'}
        value={s.interior}
        onChange={(v) => settingsStore.set({ interior: v })}
      />
      <Toggle
        label="戶外冥想音樂"
        hint="空靈長音與鐘片聲（原創），進入室內時自動淡出"
        value={track === sceneTrack}
        onChange={(v) => {
          save('ui', { ...load('ui', {}), outdoorMusic: v });
          worldStore.set({ track: v ? sceneTrack : null });
        }}
      />
      <Toggle label="只聽自然音" hint="關閉音樂、室內誦唱與互動音效；室內也保留蟲鳴鳥叫" value={s.natureOnly} onChange={(v) => settingsStore.set({ natureOnly: v })} />
      <Toggle label="細雨聲" value={s.rain} onChange={(v) => settingsStore.set({ rain: v })} />
    </div>
  );
}

export function DisplayPanel() {
  const s = useSettings((x) => x);
  const modes: ('auto' | DayPhase)[] = ['auto', 'dawn', 'day', 'dusk', 'night'];
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="mb-1 font-medium">時段</p>
        <div className="flex flex-wrap gap-1.5">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => settingsStore.set({ timeMode: m })}
              className={`chip ${s.timeMode === m ? 'border-forest bg-forest text-white' : 'border-stone-300 bg-white/70'}`}
            >
              {m === 'auto' ? '自動（臺灣時間）' : PHASE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 font-medium">畫質</p>
        <div className="flex gap-1.5">
          {(['high', 'low'] as const).map((q) => (
            <button key={q} type="button" onClick={() => settingsStore.set({ quality: q })} className={`chip ${s.quality === q ? 'border-forest bg-forest text-white' : 'border-stone-300 bg-white/70'}`}>
              {q === 'high' ? '高畫質' : '省電／低特效'}
            </button>
          ))}
        </div>
      </div>
      <Toggle label="減少動畫" hint="停止飄葉、飛鳥、水流等動態效果" value={s.reduceMotion} onChange={(v) => settingsStore.set({ reduceMotion: v })} />
    </div>
  );
}
