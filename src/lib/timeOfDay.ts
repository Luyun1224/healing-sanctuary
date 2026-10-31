export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export const PHASE_LABEL: Record<DayPhase, string> = {
  dawn: '清晨',
  day: '白天',
  dusk: '黃昏',
  night: '夜晚',
};

/** 取得臺灣時間（Asia/Taipei）的小時，不受使用者電腦時區影響 */
export function taipeiHour(date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }).format(date);
  return Number.parseInt(h, 10) % 24;
}

export function phaseForHour(h: number): DayPhase {
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 16) return 'day';
  if (h >= 16 && h < 19) return 'dusk';
  return 'night';
}
