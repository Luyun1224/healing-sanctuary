import type { SceneId } from '../config/scenes';
import { loadRaw, save } from '../lib/storage';

/** 角色外觀設定（同步到多人房間時也只傳這份精簡資料） */
export type Expression = 'smile' | 'calm' | 'joy';
export type MonkStyle = 'plain' | 'beads' | 'sash';
export type Outfit = 'shirt' | 'blazer' | 'dress' | 'knit';
export type Hair = 'short' | 'bob' | 'long' | 'bun' | 'curly';

export interface AvatarConfig {
  wardrobe: 'monk' | 'formal';
  skin: string;
  expression: Expression;
  /** 主要衣服顏色（僧袍、上衣或洋裝） */
  primary: string;
  /** 次要顏色（袈裟、外套內搭、裙子或褲子） */
  secondary: string;
  monkStyle: MonkStyle;
  outfit: Outfit;
  hair: Hair;
  hairColor: string;
}

export interface PlayerProfile {
  nickname: string;
  avatar: AvatarConfig;
}

export const SKIN_TONES = ['#ffe3cc', '#f6d1ad', '#e8b88f', '#c98f66', '#9a6847'];
export const ROBE_COLORS = ['#d99a4e', '#a8743f', '#8f6d4f', '#b5935d', '#7f8a6a', '#9b8fb0'];
export const KASAYA_COLORS = ['#b8462e', '#c97a2c', '#8b5a3c', '#6f7b56'];
export const TOP_COLORS = ['#f4f1ea', '#a9c3dd', '#9cb59a', '#e7b8b0', '#e8d3a2', '#7a8fb3', '#c4a8cf'];
export const BOTTOM_COLORS = ['#4a5468', '#6b5847', '#7d8a75', '#2f3b52', '#b9a58a'];
export const HAIR_COLORS = ['#2b2320', '#4a3427', '#7a5432', '#a7774b', '#8c8c8c'];

export const EXPRESSION_LABEL: Record<Expression, string> = { smile: '微笑', calm: '平靜', joy: '開心' };
export const MONK_STYLE_LABEL: Record<MonkStyle, string> = { plain: '素雅僧袍', beads: '佛珠', sash: '袈裟' };
export const OUTFIT_LABEL: Record<Outfit, string> = { shirt: '襯衫', blazer: '西裝外套', dress: '洋裝', knit: '針織衫' };
export const HAIR_LABEL: Record<Hair, string> = { short: '短髮', bob: '鮑伯頭', long: '長髮', bun: '包包頭', curly: '捲髮' };

export function defaultAvatar(wardrobe: 'monk' | 'formal'): AvatarConfig {
  return {
    wardrobe,
    skin: SKIN_TONES[1],
    expression: 'smile',
    primary: wardrobe === 'monk' ? ROBE_COLORS[0] : TOP_COLORS[1],
    secondary: wardrobe === 'monk' ? KASAYA_COLORS[0] : BOTTOM_COLORS[0],
    monkStyle: 'beads',
    outfit: 'knit',
    hair: 'short',
    hairColor: HAIR_COLORS[1],
  };
}

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export function randomAvatar(wardrobe: 'monk' | 'formal'): AvatarConfig {
  return {
    wardrobe,
    skin: pick(SKIN_TONES),
    expression: pick(['smile', 'calm', 'joy'] as const),
    primary: wardrobe === 'monk' ? pick(ROBE_COLORS) : pick(TOP_COLORS),
    secondary: wardrobe === 'monk' ? pick(KASAYA_COLORS) : pick(BOTTOM_COLORS),
    monkStyle: pick(['plain', 'beads', 'sash'] as const),
    outfit: pick(['shirt', 'blazer', 'dress', 'knit'] as const),
    hair: pick(['short', 'bob', 'long', 'bun', 'curly'] as const),
    hairColor: pick(HAIR_COLORS),
  };
}

export const NICKNAME_MAX = 12;

export const NICKNAME_SUGGESTIONS = [
  '今天想放空',
  '小小雲朵',
  '佛系打工人',
  '平安就好',
  '山中小旅人',
  '今天也辛苦了',
  '慢慢來的人',
  '午休的貓',
  '一杯熱茶',
  '森林散步中',
  '深呼吸一下',
  '晴天小草',
];

/** 以「字元」（code point）計算長度，中文、表情符號都算一個字 */
export function nicknameLength(s: string) {
  return Array.from(s).length;
}

/** 移除控制字元與多餘空白，並截斷到上限 */
export function sanitizeNickname(s: string) {
  // eslint-disable-next-line no-control-regex
  const clean = s.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ');
  return Array.from(clean).slice(0, NICKNAME_MAX).join('');
}

export function randomNickname() {
  return pick(NICKNAME_SUGGESTIONS);
}

const profileKey = (scene: SceneId) => `profile:${scene}`;

export function loadProfile(scene: SceneId): PlayerProfile | null {
  const p = loadRaw<PlayerProfile>(profileKey(scene));
  if (!p || typeof p.nickname !== 'string' || !p.avatar) return null;
  const wardrobe = scene === 'temple' ? 'monk' : 'formal';
  return { nickname: sanitizeNickname(p.nickname) || randomNickname(), avatar: { ...defaultAvatar(wardrobe), ...p.avatar, wardrobe } };
}

export function saveProfile(scene: SceneId, p: PlayerProfile) {
  save(profileKey(scene), p);
}
