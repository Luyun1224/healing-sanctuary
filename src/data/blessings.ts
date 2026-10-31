/**
 * 祝福文字皆為本專案原創短句，未引用經文。
 * 若未來要加入經典或聖經經文，請先確認譯本版本、出處及授權，再新增至獨立欄位並標註來源。
 */
export const LAMP_BLESSINGS = [
  '願心安定，日日平安。',
  '願你今天少一點煩惱，多一點自在。',
  '願所念之人平安喜樂。',
  '願這盞燈，照亮你回家的路。',
  '願忙碌之中，仍有片刻寧靜。',
  '願身體安康，心裡也有光。',
];

export const CANDLE_BLESSINGS = [
  '願平安與你同在，今天也被溫柔接住。',
  '願這支燭光，陪你度過忙碌的一天。',
  '願你掛念的人，都被好好照顧。',
  '願疲憊的心，在這裡得到休息。',
  '願你在平凡的日子裡，看見盼望。',
  '願今天的你，被愛、也懂得愛自己。',
];

/** 今日祝福：依日期輪替（Phase 3 起可由值日陪伴員在後台發布，取代此預設內容） */
export const DAILY_MESSAGES: Record<'temple' | 'church' | 'neutral', string[]> = {
  temple: [
    '今天辛苦了，願你的心比昨天輕一點。',
    '一呼一吸之間，讓心慢慢安住。',
    '放下不是放棄，是先讓自己喘口氣。',
    '願你在忙碌中，也記得善待自己。',
  ],
  church: [
    '願平安常在你心，今天也被溫柔看顧。',
    '你的付出有人看見，也值得被好好感謝。',
    '在忙碌之中，願你仍感受到被陪伴。',
    '願你今天遇見一些值得微笑的小事。',
  ],
  neutral: [
    '有時候，安靜下來也是很重要的事。',
    '今天的你，已經很努力了。',
    '休息一下，不會讓世界停止轉動。',
    '慢慢來，比較快。',
  ],
};

export function dailyMessage(scene: 'temple' | 'church', date = new Date()) {
  const list = [...DAILY_MESSAGES[scene], ...DAILY_MESSAGES.neutral];
  const day = Math.floor(date.getTime() / 86400000);
  return list[day % list.length];
}

export const MEDITATION_DONE = '辛苦了，願你帶著平靜繼續今天。';

export const pickOne = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
