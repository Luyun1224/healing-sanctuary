import { useEffect, useState } from 'react';
import { SCENES, type SceneId } from '../config/scenes';
import { loadProfile } from '../data/avatar';
import { dailyMessage } from '../data/blessings';
import { load, save } from '../lib/storage';
import { PHASE_LABEL } from '../lib/timeOfDay';
import { navigate } from '../router';
import { ActionBar } from '../ui/ActionBar';
import { toggleSound, useAudioDirector } from '../ui/audioHooks';
import { InteractionPanel } from '../ui/InteractionPanel';
import { Joystick } from '../ui/Joystick';
import { MeditationTimer } from '../ui/MeditationTimer';
import { DisplayPanel, SoundPanel } from '../ui/SettingsPanel';
import { Toast } from '../ui/Toast';
import { useKeyboard } from '../ui/useKeyboard';
import { useMedia } from '../ui/useMedia';
import * as A from '../world/actions';
import { useDayPhase } from '../world/env/useDayPhase';
import { audioStore } from '../world/settings';
import { WorldCanvas } from '../world/WorldCanvas';
import { resetWorld, useWorld, worldStore } from '../world/worldStore';

type Panel = 'sound' | 'display' | 'help' | null;

export default function WorldPage({ scene }: { scene: Exclude<SceneId, 'taoist'> }) {
  const profile = loadProfile(scene);
  const cfg = SCENES[scene];
  const phase = useDayPhase();
  const sound = audioStore.useStore((s) => s.enabled);
  const fishAuto = useWorld((s) => s.fishAuto);
  const nearbyKind = useWorld((s) => s.nearby?.kind);
  const touch = useMedia('(pointer: coarse)');
  const narrow = useMedia('(max-width: 640px)');
  const [panel, setPanel] = useState<Panel>(() => (load('ui', { helpSeen: false }).helpSeen ? null : 'help'));
  const [cardOpen, setCardOpen] = useState(!narrow);

  useKeyboard();
  useAudioDirector(phase);

  useEffect(() => {
    resetWorld(scene);
    return () => {
      worldStore.set({ track: null, fishAuto: false });
    };
  }, [scene]);

  // 沒有角色設定時先前往建立角色
  useEffect(() => {
    if (!profile) navigate(`/create/${scene}`);
  }, [profile, scene]);

  // 自動慢敲：每秒一次；離開木魚或起身即停止
  useEffect(() => {
    if (!fishAuto) return;
    const id = window.setInterval(() => {
      const s = worldStore.get();
      if (!s.fishAuto || s.nearby?.kind !== 'fish') {
        worldStore.set({ fishAuto: false });
        return;
      }
      A.strike();
    }, 1000);
    return () => window.clearInterval(id);
  }, [fishAuto]);
  useEffect(() => {
    if (nearbyKind !== 'fish' && worldStore.get().fishAuto) worldStore.set({ fishAuto: false });
  }, [nearbyKind]);

  if (!profile) return null;
  const other = scene === 'temple' ? 'church' : 'temple';
  const closeHelp = () => {
    save('ui', { helpSeen: true });
    setPanel(null);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#dfe9dc]">
      <WorldCanvas scene={scene} avatar={profile.avatar} nickname={profile.nickname} />

      <div className="pointer-events-none absolute inset-0 flex flex-col p-3 sm:p-4">
        {/* 上方列 */}
        <div className="flex items-start justify-between gap-2">
          <div className="glass pointer-events-auto px-3 py-2">
            <p className="text-sm font-bold text-forest">
              {cfg.name}
              <span className="font-medium text-stone-500">｜單人模式</span>
            </p>
            <p className="text-[11px] text-stone-500" title="多人同步（Google Sheets + Apps Script）將於 Phase 2 開放；在線人數只會依真實玩家狀態計算。">
              山林大廳・{PHASE_LABEL[phase]}・多人同步尚未開放
            </p>
          </div>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
            <button type="button" className={`btn ${sound ? 'bg-forest text-white' : 'bg-white/85 text-stone-700'}`} onClick={toggleSound} aria-pressed={sound}>
              {sound ? '🔊 聲音開' : '🔇 開啟聲音'}
            </button>
            <button type="button" className="btn-soft" onClick={() => setPanel(panel === 'sound' ? null : 'sound')} aria-label="音效設定">
              🎚️{!narrow && ' 音效'}
            </button>
            <button type="button" className="btn-soft" onClick={() => setPanel(panel === 'display' ? null : 'display')} aria-label="畫面設定">
              ⚙️{!narrow && ' 設定'}
            </button>
            <button type="button" className="btn-soft" onClick={() => navigate(loadProfile(other) ? `/world/${other}` : `/create/${other}`)}>
              ⇄{!narrow && ` ${SCENES[other].name}`}
            </button>
            <button type="button" className="btn-soft" onClick={() => setPanel(panel === 'help' ? null : 'help')} aria-label="操作說明">
              ？
            </button>
            <button type="button" className="btn-soft" onClick={() => navigate('/')} aria-label="返回首頁">
              🏠
            </button>
          </div>
        </div>

        {panel && (
          <div className="pointer-events-auto mt-2 self-end">
            <div className="glass w-[min(92vw,340px)] animate-fade-up p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold text-forest">{panel === 'sound' ? '音效設定' : panel === 'display' ? '畫面設定' : '操作說明'}</p>
                <button type="button" className="text-sm text-stone-500" onClick={panel === 'help' ? closeHelp : () => setPanel(null)}>
                  關閉
                </button>
              </div>
              {panel === 'sound' && <SoundPanel scene={scene} />}
              {panel === 'display' && <DisplayPanel />}
              {panel === 'help' && <Help touch={touch} scene={scene} onClose={closeHelp} />}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* 下方：搖桿、互動面板、動作列、右下卡片 */}
        <div className="flex items-end justify-between gap-2">
          <div className="hidden w-32 sm:block">{touch && <Joystick />}</div>
          <div className="flex flex-1 flex-col items-center gap-2">
            <InteractionPanel scene={scene} />
            <MeditationTimer />
            <ActionBar scene={scene} compact={narrow} />
          </div>
          <div className="hidden w-64 sm:block">
            <DailyCard scene={scene} open={cardOpen} setOpen={setCardOpen} />
          </div>
        </div>
        {touch && (
          <div className="pointer-events-auto absolute bottom-24 left-3 sm:hidden">
            <Joystick />
          </div>
        )}
      </div>
      <Toast />
    </div>
  );
}

function DailyCard({ scene, open, setOpen }: { scene: 'temple' | 'church'; open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <div className="glass pointer-events-auto p-3">
      <button type="button" className="flex w-full items-center justify-between text-left text-xs font-bold text-forest" onClick={() => setOpen(!open)}>
        今日祝福 <span className="text-stone-400">{open ? '－' : '＋'}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-2 text-sm">
          <p className="leading-relaxed">{dailyMessage(scene)}</p>
          <p className="border-t border-stone-200 pt-2 text-[11px] text-stone-500">主持人公告：目前沒有公告</p>
        </div>
      )}
    </div>
  );
}

function Help({ touch, scene, onClose }: { touch: boolean; scene: 'temple' | 'church'; onClose: () => void }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {touch ? (
        <ul className="list-disc space-y-1 pl-5">
          <li>左下搖桿移動，或點一下地面走過去</li>
          <li>單指拖曳旋轉視角，雙指縮放</li>
        </ul>
      ) : (
        <ul className="list-disc space-y-1 pl-5">
          <li>WASD／方向鍵移動，或點擊地面走過去</li>
          <li>滑鼠拖曳旋轉視角、滾輪縮放；Q／E 也能旋轉</li>
        </ul>
      )}
      <p>
        {scene === 'temple'
          ? '走進佛堂：木魚、蒲團、佛像、平安燈都可以互動；外面還有鐘亭、涼亭與瀑布。'
          : '走進教堂：長椅、祭壇、祝福蠟燭、鋼琴都可以互動；外面有鐘樓、花園與瀑布。'}
      </p>
      <p className="text-xs text-stone-500">聲音預設關閉，點右上角「開啟聲音」即可播放自然音。</p>
      <button type="button" className="btn-primary w-full" onClick={onClose}>
        開始散步
      </button>
    </div>
  );
}
