import { useEffect } from 'react';
import { audio } from '../audio/engine';
import type { DayPhase } from '../lib/timeOfDay';
import { audioStore, settingsStore } from '../world/settings';
import { worldStore } from '../world/worldStore';

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
  } else {
    audio.applySettings(settingsStore.get());
    const ok = await audio.start();
    audioStore.set({ enabled: ok });
  }
}
