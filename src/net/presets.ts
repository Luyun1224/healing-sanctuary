/** 預設互動（伺服器端有相同的白名單）；不開放自由文字聊天 */
export const PRESETS = [
  { id: 'wave', label: '揮手', text: '👋', anim: 'wave' },
  { id: 'palms', label: '合掌', text: '🙏', anim: 'handsTogether' },
  { id: 'smile', label: '微笑', text: '😊', anim: 'happy' },
  { id: 'heart', label: '愛心', text: '💗', anim: 'happy' },
  { id: 'thanks', label: '辛苦了！', text: '辛苦了！', anim: 'wave' },
  { id: 'peace', label: '願你平安。', text: '願你平安。', anim: 'bow' },
  { id: 'great', label: '今天也很棒！', text: '今天也很棒！', anim: 'happy' },
  { id: 'rest', label: '一起休息一下吧！', text: '一起休息一下吧！', anim: 'wave' },
] as const;

export type PresetId = (typeof PRESETS)[number]['id'];
export const presetById = (id: string) => PRESETS.find((p) => p.id === id);
export const INTERACT_COOLDOWN_MS = 8000;
