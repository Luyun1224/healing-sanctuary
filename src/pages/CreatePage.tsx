import { useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { SCENES, type SceneId } from '../config/scenes';
import {
  BOTTOM_COLORS,
  EXPRESSION_LABEL,
  HAIR_COLORS,
  HAIR_LABEL,
  KASAYA_COLORS,
  MONK_STYLE_LABEL,
  NICKNAME_MAX,
  NICKNAME_SUGGESTIONS,
  OUTFIT_LABEL,
  ROBE_COLORS,
  SKIN_TONES,
  TOP_COLORS,
  defaultAvatar,
  loadProfile,
  nicknameLength,
  randomAvatar,
  randomNickname,
  sanitizeNickname,
  saveProfile,
  type AvatarConfig,
} from '../data/avatar';
import { navigate } from '../router';
import { Chibi, type PoseInput } from '../world/character/Chibi';
import type { Anim } from '../world/types';

function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={`h-7 w-7 rounded-full border-2 transition ${value === c ? 'scale-110 border-forest' : 'border-white'}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

function Chips<T extends string>({ options, value, onChange }: { options: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(options) as T[]).map((k) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={`chip ${value === k ? 'border-forest bg-forest text-white' : 'border-stone-300 bg-white/80'}`}>
          {options[k]}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold text-stone-600">{label}</p>
      {children}
    </div>
  );
}

const PREVIEW_ANIMS: { anim: Anim; label: string; eyes?: boolean }[] = [
  { anim: 'idle', label: '站立' },
  { anim: 'walk', label: '行走' },
  { anim: 'wave', label: '揮手' },
  { anim: 'happy', label: '開心' },
  { anim: 'bow', label: '鞠躬' },
  { anim: 'handsTogether', label: '合掌' },
  { anim: 'pray', label: '禱告', eyes: true },
  { anim: 'meditate', label: '靜坐', eyes: true },
  { anim: 'sit', label: '坐下' },
  { anim: 'fishDrum', label: '敲木魚' },
];

export default function CreatePage({ scene }: { scene: Exclude<SceneId, 'taoist'> }) {
  const cfg = SCENES[scene];
  const wardrobe = scene === 'temple' ? 'monk' : 'formal';
  const existing = loadProfile(scene);
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [avatar, setAvatar] = useState<AvatarConfig>(existing?.avatar ?? defaultAvatar(wardrobe));
  const [anim, setAnim] = useState<Anim>('idle');
  const pose = useRef<PoseInput>({ anim: 'idle', eyesClosed: false, strikeAt: 0, speed: 0.6, seated: null });
  const set = (p: Partial<AvatarConfig>) => setAvatar((a) => ({ ...a, ...p }));
  const name = sanitizeNickname(nickname).trim();
  const len = nicknameLength(nickname);

  const preview = (a: (typeof PREVIEW_ANIMS)[number]) => {
    setAnim(a.anim);
    pose.current.anim = a.anim;
    pose.current.eyesClosed = !!a.eyes;
    pose.current.seated = null;
    if (a.anim === 'fishDrum') {
      const tick = () => {
        if (pose.current.anim !== 'fishDrum') return;
        pose.current.strikeAt = performance.now();
        window.setTimeout(tick, 1000);
      };
      tick();
    }
  };

  const enter = () => {
    if (!name) return;
    saveProfile(scene, { nickname: name, avatar });
    navigate(`/world/${scene}`);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-b from-[#e7efe2] to-cream md:flex-row md:overflow-hidden">
      <div className="relative h-[42vh] shrink-0 md:h-full md:flex-1">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.3, 3.4], fov: 38 }}>
          <color attach="background" args={['#e5eedf']} />
          <hemisphereLight args={['#ffffff', '#9cbf83', 1]} />
          <directionalLight position={[3, 5, 4]} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]} />
          <group position={[0, -0.05, 0]}>
            <group position={[0, anim === 'meditate' || anim === 'sit' ? -0.22 : 0, 0]}>
              <Chibi avatar={avatar} pose={pose} />
            </group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
              <circleGeometry args={[1.1, 40]} />
              <meshStandardMaterial color="#a8c98d" />
            </mesh>
            <mesh position={[0, -0.12, 0]}>
              <cylinderGeometry args={[1.1, 1.0, 0.2, 40]} />
              <meshStandardMaterial color="#c9a27a" />
            </mesh>
          </group>
          <OrbitControls target={[0, 0.65, 0]} enablePan={false} minDistance={2} maxDistance={6} autoRotate autoRotateSpeed={1.2} maxPolarAngle={1.55} />
        </Canvas>
        <button type="button" className="btn-soft absolute left-3 top-3 shadow" onClick={() => navigate('/')}>
          ← 返回山谷
        </button>
        <div className="absolute inset-x-0 bottom-2 flex flex-wrap justify-center gap-1 px-2">
          {PREVIEW_ANIMS.filter((a) => (scene === 'temple' ? a.anim !== 'pray' : a.anim !== 'fishDrum' && a.anim !== 'meditate')).map((a) => (
            <button key={a.anim} type="button" onClick={() => preview(a)} className={`chip ${anim === a.anim ? 'border-forest bg-forest text-white' : 'border-white bg-white/80'}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full space-y-4 p-5 md:h-full md:w-[420px] md:overflow-y-auto">
        <div>
          <p className="text-xs font-medium" style={{ color: cfg.accent }}>
            建立角色・{cfg.name}
          </p>
          <h1 className="text-2xl font-bold text-stone-700">今天想用什麼樣子散步？</h1>
          <p className="text-xs text-stone-500">不需要真實姓名。設定只會保存在這台裝置的瀏覽器中。</p>
        </div>

        <Row label={`暱稱（${len}/${NICKNAME_MAX} 字）`}>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(sanitizeNickname(e.target.value))}
              placeholder="例如：今天想放空"
              maxLength={NICKNAME_MAX * 2}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest"
              aria-label="暱稱"
            />
            <button type="button" className="btn-soft shrink-0 border border-stone-200" onClick={() => setNickname(randomNickname())}>
              🎲 隨機
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {NICKNAME_SUGGESTIONS.slice(0, 6).map((n) => (
              <button key={n} type="button" onClick={() => setNickname(n)} className="chip border-stone-200 bg-white/70 text-stone-600">
                {n}
              </button>
            ))}
          </div>
        </Row>

        <Row label="膚色">
          <Swatches label="膚色" colors={SKIN_TONES} value={avatar.skin} onChange={(skin) => set({ skin })} />
        </Row>
        <Row label="表情">
          <Chips options={EXPRESSION_LABEL} value={avatar.expression} onChange={(expression) => set({ expression })} />
        </Row>

        {wardrobe === 'monk' ? (
          <>
            <Row label="小沙彌造型">
              <Chips options={MONK_STYLE_LABEL} value={avatar.monkStyle} onChange={(monkStyle) => set({ monkStyle })} />
            </Row>
            <Row label="僧袍顏色">
              <Swatches label="僧袍顏色" colors={ROBE_COLORS} value={avatar.primary} onChange={(primary) => set({ primary })} />
            </Row>
            {avatar.monkStyle === 'sash' && (
              <Row label="袈裟顏色">
                <Swatches label="袈裟顏色" colors={KASAYA_COLORS} value={avatar.secondary} onChange={(secondary) => set({ secondary })} />
              </Row>
            )}
          </>
        ) : (
          <>
            <Row label="服裝">
              <Chips options={OUTFIT_LABEL} value={avatar.outfit} onChange={(outfit) => set({ outfit })} />
            </Row>
            <Row label={avatar.outfit === 'dress' ? '洋裝上身顏色' : '上衣顏色'}>
              <Swatches label="上衣顏色" colors={TOP_COLORS} value={avatar.primary} onChange={(primary) => set({ primary })} />
            </Row>
            <Row label={avatar.outfit === 'dress' ? '裙子顏色' : avatar.outfit === 'blazer' ? '翻領與褲子顏色' : '褲子／配色'}>
              <Swatches label="次要顏色" colors={[...BOTTOM_COLORS, ...TOP_COLORS.slice(0, 3)]} value={avatar.secondary} onChange={(secondary) => set({ secondary })} />
            </Row>
            <Row label="髮型">
              <Chips options={HAIR_LABEL} value={avatar.hair} onChange={(hair) => set({ hair })} />
            </Row>
            <Row label="髮色">
              <Swatches label="髮色" colors={HAIR_COLORS} value={avatar.hairColor} onChange={(hairColor) => set({ hairColor })} />
            </Row>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <button type="button" className="btn-soft flex-1 border border-stone-200" onClick={() => setAvatar(randomAvatar(wardrobe))}>
            🎲 隨機外觀
          </button>
          <button type="button" className="btn-primary flex-[2] py-3 text-base" disabled={!name} onClick={enter}>
            進入{cfg.name}
          </button>
        </div>
        {!name && <p className="text-center text-xs text-stone-500">請先輸入或選擇一個暱稱</p>}
      </div>
    </div>
  );
}
