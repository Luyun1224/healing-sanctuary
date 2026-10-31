/**
 * 場景註冊表
 * 新增場景（例如未來的「祈福道觀」）時：在此加入設定、建立對應的 3D 場景元件與角色服裝，
 * 並將 enabled 設為 true。未完成的場景不會在入口顯示。
 */
export type SceneId = 'temple' | 'church' | 'taoist';

export interface SceneConfig {
  id: SceneId;
  name: string;
  subtitle: string;
  description: string;
  accent: string;
  /** 角色服裝系列 */
  wardrobe: 'monk' | 'formal' | 'taoist';
  enabled: boolean;
}

export const SCENES: Record<SceneId, SceneConfig> = {
  temple: {
    id: 'temple',
    name: '靜心佛堂',
    subtitle: '竹林、流水與木魚聲',
    description: '走進山林中的木造佛堂，敲敲木魚、點一盞平安燈，或在蒲團上靜坐片刻。',
    accent: '#b7793f',
    wardrobe: 'monk',
    enabled: true,
  },
  church: {
    id: 'church',
    name: '平安教堂',
    subtitle: '花園、燭光與琴聲',
    description: '推開山間小教堂的木門，在長椅坐下、點一支祝福蠟燭，聽一段柔和的琴聲。',
    accent: '#6f8fb8',
    wardrobe: 'formal',
    enabled: true,
  },
  taoist: {
    id: 'taoist',
    name: '祈福道觀',
    subtitle: '規劃中',
    description: '保留給未來的道觀場景，完成前不開放進入。',
    accent: '#a35d4a',
    wardrobe: 'taoist',
    enabled: false,
  },
};

export const ENABLED_SCENES = Object.values(SCENES).filter((s) => s.enabled);

export function getScene(id: string | undefined): SceneConfig | null {
  if (!id || !(id in SCENES)) return null;
  const s = SCENES[id as SceneId];
  return s.enabled ? s : null;
}
