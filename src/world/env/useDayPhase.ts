import { createContext, useContext, useEffect, useState } from 'react';
import { phaseForHour, taipeiHour, type DayPhase } from '../../lib/timeOfDay';
import { useSettings } from '../settings';

/** 依設定回傳目前時段：自動模式依臺灣時間每分鐘更新 */
export function useDayPhase(): DayPhase {
  const mode = useSettings((s) => s.timeMode);
  const [auto, setAuto] = useState(() => phaseForHour(taipeiHour()));
  useEffect(() => {
    if (mode !== 'auto') return;
    setAuto(phaseForHour(taipeiHour()));
    const id = window.setInterval(() => setAuto(phaseForHour(taipeiHour())), 60_000);
    return () => window.clearInterval(id);
  }, [mode]);
  return mode === 'auto' ? auto : mode;
}

export const PhaseCtx = createContext<DayPhase>('day');
export const usePhase = () => useContext(PhaseCtx);
export const isDark = (p: DayPhase) => p === 'night' || p === 'dusk';
