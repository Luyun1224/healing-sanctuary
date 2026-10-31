import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ENABLED_SCENES, type SceneConfig } from '../config/scenes';
import { loadProfile } from '../data/avatar';
import { navigate } from '../router';
import { Sky } from '../world/env/Sky';
import { Clouds, Fauna, Ground, Mist, Mountains, SteppingStones, VegetationMeshes } from '../world/env/Valley';
import { PhaseCtx, useDayPhase } from '../world/env/useDayPhase';
import { makeVegetation } from '../world/layouts/valley';
import { MiniChurch, MiniTemple } from '../world/scenes/Mini';
import { useSettings } from '../world/settings';
import { Box, Cyl } from '../world/env/prims';
import { textTexture } from '../world/env/textures';

const go = (id: string) => navigate(loadProfile(id as 'temple' | 'church') ? `/world/${id}` : `/create/${id}`);

/** 鏡頭從空中薄霧緩慢降入山谷 */
function IntroCamera({ reduceMotion }: { reduceMotion: boolean }) {
  const camera = useThree((s) => s.camera);
  const t0 = useRef<number | null>(null);
  const from = useMemo(() => new THREE.Vector3(0, 48, 70), []);
  const to = useMemo(() => new THREE.Vector3(0, 8.5, 25), []);
  const look = useMemo(() => new THREE.Vector3(0, 2, -6), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock, pointer }) => {
    if (t0.current === null) t0.current = clock.getElapsedTime();
    const k = reduceMotion ? 1 : Math.min(1, (clock.getElapsedTime() - t0.current) / 6);
    const e = 1 - Math.pow(1 - k, 3);
    tmp.lerpVectors(from, to, e);
    // 滑鼠位置帶來些微視差
    tmp.x += pointer.x * 1.2 * e;
    tmp.y += pointer.y * 0.5 * e;
    camera.position.copy(tmp);
    camera.lookAt(look);
  });
  return null;
}

function Signpost() {
  const left = useMemo(() => textTexture('← 靜心佛堂', { bg: '#f3e6cc', fg: '#7b4a2f', w: 512, h: 128, font: 64 }), []);
  const right = useMemo(() => textTexture('平安教堂 →', { bg: '#eef2f6', fg: '#4d6a8f', w: 512, h: 128, font: 64 }), []);
  return (
    <group position={[0, 0, 8.5]}>
      <Cyl args={[0.08, 0.1, 2.4, 6]} position={[0, 1.2, 0]} color="#8a5c38" />
      <mesh position={[-0.75, 1.95, 0.08]} rotation={[0, 0.15, 0.03]}>
        <planeGeometry args={[1.8, 0.45]} />
        <meshStandardMaterial map={left} />
      </mesh>
      <mesh position={[0.75, 1.4, 0.08]} rotation={[0, -0.15, -0.03]}>
        <planeGeometry args={[1.8, 0.45]} />
        <meshStandardMaterial map={right} />
      </mesh>
    </group>
  );
}

function ForkPath() {
  const stones = (from: [number, number], to: [number, number]) => {
    const n = Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.8);
    return Array.from({ length: n }, (_, i) => {
      const t = i / n;
      return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as [number, number];
    });
  };
  const all = [...stones([0, 8], [-9, -4]), ...stones([0, 8], [9, -4])];
  return (
    <group>
      <SteppingStones fromZ={8.5} toZ={28} />
      {all.map(([x, z], i) => (
        <Box key={i} size={[0.8, 0.06, 0.6]} position={[x, 0.03, z]} rotation={[0, i * 0.7, 0]} color="#d8cfbd" shadow={false} />
      ))}
    </group>
  );
}

function Hoverable({ id, position, children, hovered, setHovered }: { id: string; position: [number, number, number]; children: React.ReactNode; hovered: string | null; setHovered: (v: string | null) => void }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const target = hovered === id ? 0.4 : 0;
    g.position.y += (target - g.position.y) * (1 - Math.exp(-dt * 6));
  });
  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = '';
      }}
      onClick={(e) => {
        e.stopPropagation();
        go(id);
      }}
    >
      <group ref={ref}>{children}</group>
    </group>
  );
}

function ValleyScene({ hovered, setHovered }: { hovered: string | null; setHovered: (v: string | null) => void }) {
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const low = useSettings((s) => s.quality) === 'low';
  const phase = useDayPhase();
  const veg = useMemo(
    () =>
      makeVegetation(
        777,
        [
          { x: -11, z: -8, hw: 5, hd: 5 },
          { x: 11, z: -8, hw: 5, hd: 5 },
          { x: 0, z: 10, hw: 3, hd: 20 },
          { x: -4.5, z: 2, hw: 5, hd: 4 },
          { x: 4.5, z: 2, hw: 5, hd: 4 },
        ],
        [{ x: -18, z: -10, hw: 3, hd: 4 }],
        [
          { x: -3, z: 13, hw: 1.5, hd: 3 },
          { x: 3, z: 13, hw: 1.5, hd: 3 },
          { x: 0, z: 2, hw: 2, hd: 1.5 },
        ],
      ),
    [],
  );
  return (
    <PhaseCtx.Provider value={phase}>
      <Sky phase={phase} reduceMotion={reduceMotion} low={low} />
      <Mountains low={low} />
      <Mist reduceMotion={reduceMotion} low={low} />
      <Clouds />
      <Ground />
      <ForkPath />
      <Signpost />
      <VegetationMeshes veg={{ ...veg, rocks: [] }} low={low} />
      <Fauna reduceMotion={reduceMotion} low={low} butterflyZones={[[0, 10]]} />
      <Hoverable id="temple" position={[-11, 0, -8]} hovered={hovered} setHovered={setHovered}>
        <group rotation={[0, 0.5, 0]}>
          <MiniTemple />
        </group>
      </Hoverable>
      <Hoverable id="church" position={[11, 0, -8]} hovered={hovered} setHovered={setHovered}>
        <group rotation={[0, -0.5, 0]}>
          <MiniChurch />
        </group>
      </Hoverable>
      <IntroCamera reduceMotion={reduceMotion} />
    </PhaseCtx.Provider>
  );
}

/** 卡片內的 3D 立體預覽 */
function Spin({ scene, hovered }: { scene: SceneConfig; hovered: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * (hovered ? 0.6 : 0.2);
  });
  return <group ref={ref}>{scene.id === 'temple' ? <MiniTemple /> : <MiniChurch />}</group>;
}

function CardPreview({ scene, hovered }: { scene: SceneConfig; hovered: boolean }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [7, 5, 9], fov: 40 }} frameloop="always" gl={{ alpha: true }}>
      <hemisphereLight args={['#ffffff', '#9cbf83', hovered ? 1.3 : 0.95]} />
      <directionalLight position={[5, 8, 5]} intensity={hovered ? 2 : 1.5} />
      <group position={[0, -2, 0]}>
        <Spin scene={scene} hovered={hovered} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[4.6, 32]} />
          <meshStandardMaterial color="#a8c98d" />
        </mesh>
      </group>
    </Canvas>
  );
}

export default function HomePage() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState(false);
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#dfe9dc]">
      <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 45, near: 0.1, far: 900, position: [0, 48, 70] }}>
        <ValleyScene hovered={hovered} setHovered={setHovered} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center overflow-y-auto px-4 pb-6 pt-[8vh] text-center">
        <div className="animate-fade-in">
          <p className="text-xs font-medium tracking-[0.35em] text-forest/80">HEALING SANCTUARY</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-700 drop-shadow-sm sm:text-5xl">心靈充電所</h1>
          <p className="mt-3 text-lg font-medium text-stone-700 sm:text-2xl">世界有點吵，來這裡安靜一下。</p>
          <p className="mt-1 text-sm text-stone-600 sm:text-base">今天辛苦了，為自己留一點喘息的時間。</p>
        </div>
        <div className="flex-1" />
        <div className="pointer-events-auto mt-6 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
          {ENABLED_SCENES.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseEnter={() => setHovered(s.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => go(s.id)}
              className={`glass group flex items-center gap-3 p-3 text-left transition duration-300 ${hovered === s.id ? '-translate-y-1.5 shadow-xl ring-2 ring-white' : ''}`}
            >
              <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-32" style={{ background: `linear-gradient(160deg, #fbf6ea, ${s.accent}33)` }}>
                <CardPreview scene={s} hovered={hovered === s.id} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: s.accent }}>
                  {s.id === 'temple' ? '← 左側山路' : '右側山路 →'}・{s.subtitle}
                </p>
                <p className="text-lg font-bold text-stone-700">{s.name}</p>
                <p className="text-xs leading-relaxed text-stone-600">{s.description}</p>
                <p className="mt-1 text-xs font-bold text-forest">{loadProfile(s.id as 'temple' | 'church') ? '繼續散步 →' : '建立角色並進入 →'}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="pointer-events-auto mt-3 text-[11px] text-stone-600">
          這裡尊重每一種信仰，也歡迎沒有信仰的你；所有互動皆為自願參與。
          <button type="button" className="ml-1 underline" onClick={() => setPrivacy(true)}>
            隱私說明
          </button>
        </p>
      </div>

      {privacy && <PrivacyNote onClose={() => setPrivacy(false)} />}
    </div>
  );
}

export function PrivacyNote({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-5" onClick={onClose}>
      <div className="glass max-h-[85vh] max-w-md animate-fade-up overflow-y-auto p-6 text-left text-sm leading-relaxed" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-lg font-bold text-forest">隱私說明</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>不需要真實姓名、員工編號或任何個人資料，暱稱可以隨意取。</li>
          <li>角色外觀、暱稱、音量與畫面設定只存在你自己的瀏覽器（localStorage）。</li>
          <li>不記錄你的宗教身分；選擇佛堂或教堂不會被保存到伺服器。</li>
          <li>敲木魚次數、點燈、靜坐等紀錄只存在本機，不做排名、不公開。</li>
          <li>開啟多人同步時，只會傳送暱稱、角色外觀、目前位置與動作，暫存在 Google Apps Script 快取中，離線約 75 秒後自動清除，不寫入試算表。</li>
          <li>伺服器只另外記錄「每日各場景加入次數與尖峰人數」這類匿名統計，不含任何可識別個人的資料。</li>
          <li>祈福留言板上的留言會公開給所有人看見（可選擇匿名），請勿寫下真實姓名、病人或任何個人資料；管理員會移除不適當內容。為了防止洗版，瀏覽器會保存一組隨機代碼，只用於限制留言頻率，不代表你的身分。</li>
          <li>心情、煩惱、靜坐紀錄等個人內容都不會上傳。正式上線前將依使用單位資訊安全政策審查。</li>
          <li>本網站提供放鬆與休息，不是心理治療或醫療服務；如果你正感到難以負荷，請尋求身邊的人或專業協助。</li>
        </ul>
        <button type="button" className="btn-primary mt-4 w-full" onClick={onClose}>
          我知道了
        </button>
      </div>
    </div>
  );
}
