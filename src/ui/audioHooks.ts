import { useEffect } from 'react';
import { audio } from '../audio/engine';
import type { DayPhase } from '../lib/timeOfDay';
import { audioStore, settingsStore } from '../world/settings';
import { worldStore } from '../world/worldStore';
import { load, save } from '../lib/storage';

/** 將設定、時段、背景音樂選擇同步到音效引擎 */
export function useAudioDirector(phase: DayPhase) {
  useEffect(() => {
    audio.applySettings(settingsStore.get());
    return settingsStore.subscribe(() => audio.applySettings(settingsStore.get()));
  }, []);
  useEffect(() => audio.setPhase(phase), [phase]);
  useEffect(() => {
    let last = worldStore.get().track;
    audio.setTrack(last);
    return worldStore.subscribe(() => {
      const t = worldStore.get().track;
      if (t !== last) {
        last = t;
        audio.setTrack(t);
      }
    });
  }, []);
}

export async function toggleSound() {
  if (audioStore.get().enabled) {
    audio.stop();
    audioStore.set({ enabled: false });
    save('sound', { wanted: false });
  } else {
    audio.applySettings(settingsStore.get());
    const ok = await audio.start();
    audioStore.set({ enabled: ok });
    if (ok) save('sound', { wanted: true });
  }
}

/**
 * 第一次造訪預設靜音；使用者曾經開啟過聲音時，之後進入世界的第一次點擊或按鍵就自動恢復聲音
 * （瀏覽器規定必須有使用者操作才能播放）。
 */
export function useAutoResumeSound() {
  useEffect(() => {
    if (!load('sound', { wanted: false }).wanted) return;
    const resume = () => {
      cleanup();
      if (!audioStore.get().enabled) void toggleSound();
    };
    const cleanup = () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    return cleanup;
  }, []);
}
