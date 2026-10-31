import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CHURCH, CHURCH_CANDLE_IDS, churchVegetation } from '../layouts/church';
import { pavilion } from '../layouts/valley';
import { Fauna, Pavilion, SteppingStones, StreamBench, VegetationMeshes } from '../env/Valley';
import { Bench, Box, Cone, Cyl, GableRoof, Glow, Sphere, getGlowTexture } from '../env/prims';
import { FadeGroup } from '../env/FadeGroup';
import { Offering } from './Offering';
import { stainedGlassTexture, textTexture } from '../env/textures';
import { isDark, usePhase } from '../env/useDayPhase';
import { useWorld, worldStore } from '../worldStore';
import { dailyMessage } from '../../data/blessings';

const STONE = '#f3eee4';
const STONE_SHADE = '#e2dbcd';
const ROOF = '#9fb4cc';
const TRIM = '#b88a5a';

const P = CHURCH.platform;
const N = CHURCH.nave;
const FY = P.h;

/** 平安教堂場景（教堂建築、長椅、祭壇、燭台、鋼琴、鐘樓、花園） */
export function ChurchScene({ low, reduceMotion }: { low: boolean; reduceMotion: boolean }) {
  return (
    <group>
      <Nave />
      <Tower />
      <Pews />
      <AltarArea />
      <CandleStand />
      <Offering variant="church" position={[CHURCH.offering.x, FY, CHURCH.offering.z]} rotationY={Math.PI / 2 - 0.75} />
      <Piano />
      <InteriorLight />
      <BlessingBoard />
      <Garden />
      <Bench position={[CHURCH.bench.x, 0, CHURCH.bench.z]} rotation={[0, -Math.PI / 2, 0]} color="#f2ece0" />
      <Pavilion variant="white" rot={pavilion('').rot} />
      <StreamBench />
      <SteppingStones fromZ={5} toZ={24} />
      <VegetationMeshes veg={churchVegetation} low={low} />
      <Fauna reduceMotion={reduceMotion} low={low} butterflyZones={[[-4.6, 2.6], [4.6, 2.6], [-14, -9], [14, -9]]} />
    </group>
  );
}

function Nave() {
  const width = N.x1 - N.x0;
  const depth = N.z1 - N.z0;
  const cz = (N.z0 + N.z1) / 2;
  const h = N.height;
  const midY = FY + h / 2;
  const seg = N.x1 - N.door;
  const glass = [1, 2, 3].map((s) => stainedGlassTexture(s * 17));
  const rose = stainedGlassTexture(99);
  return (
    <group>
      {/* 台基、木地板、走道地毯 */}
      <Box size={[P.hw * 2, P.h, P.hd * 2]} position={[P.x, P.h / 2, P.z]} color="#dcd5c6" />
      <Box size={[width, 0.04, depth]} position={[0, FY + 0.02, cz]} color="#c8a074" shadow={false} />
      <Box size={[1.4, 0.05, depth - 3]} position={[0, FY + 0.03, cz + 1.3]} color="#b9605a" shadow={false} />
      <Box size={[9.6, CHURCH.chancel.h, CHURCH.chancel.z1 - CHURCH.chancel.z0]} position={[0, FY + CHURCH.chancel.h / 2, (CHURCH.chancel.z0 + CHURCH.chancel.z1) / 2]} color="#d8c3a2" />
      {[0, 1].map((i) => (
        <Box key={i} size={[4, P.h - i * 0.15, 0.45]} position={[0, (P.h - i * 0.15) / 2, P.z + P.hd + 0.2 + i * 0.45]} color="#e2dbcd" />
      ))}

      {/* 牆面 */}
      <Box size={[width + 0.3, h, 0.3]} position={[0, midY, N.z0]} color={STONE} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[0.3, h, depth]} position={[s * N.x1, midY, cz]} color={STONE} />
          <Box size={[seg, 0.7, 0.3]} position={[s * (N.door + seg / 2), FY + 0.35, N.z1]} color={STONE} />
          {/* 扶壁 */}
          {[-5.5, -9, -12.5].map((z) => (
            <Box key={z} size={[0.4, h * 0.75, 0.5]} position={[s * (N.x1 + 0.3), FY + (h * 0.75) / 2, z + 1.75]} color={STONE_SHADE} />
          ))}
          {/* 彩繪玻璃窗（內外兩面） */}
          {[-6.2, -9.7, -13.2].map((z, i) => (
            <group key={z} position={[s * N.x1, FY + 2.05, z + 1.75]}>
              {[-1, 1].map((side) => (
                <mesh key={side} position={[side * 0.16, 0, 0]} rotation={[0, side * (Math.PI / 2), 0]}>
                  <planeGeometry args={[0.9, 1.8]} />
                  <meshStandardMaterial map={glass[i]} emissive="#ffffff" emissiveMap={glass[i]} emissiveIntensity={0.45} />
                </mesh>
              ))}
              <Sphere r={0.45} position={[0, 0.9, 0]} scale={[0.4, 1, 1]} color={STONE_SHADE} shadow={false} />
            </group>
          ))}
        </group>
      ))}
      {/* 正面牆（室內時淡出，只保留矮牆） */}
      <FadeGroup>
        {[-1, 1].map((s) => (
          <Box key={s} size={[seg, h - 0.7, 0.3]} position={[s * (N.door + seg / 2), FY + 0.7 + (h - 0.7) / 2, N.z1]} color={STONE} />
        ))}
        <Box size={[N.door * 2, 0.9, 0.3]} position={[0, FY + h - 0.45, N.z1]} color={STONE} />
        <GableRoof width={width + 0.3} depth={0.3} height={2.4} position={[0, FY + h, N.z1]} color={STONE} />
        <mesh position={[0, FY + h + 1.05, N.z1 + 0.17]}>
          <circleGeometry args={[0.75, 24]} />
          <meshStandardMaterial map={rose} emissive="#ffffff" emissiveMap={rose} emissiveIntensity={0.4} />
        </mesh>
      </FadeGroup>
      {/* 木門（敞開） */}
      {[-1, 1].map((s) => (
        <Box key={s} size={[N.door, 2.6, 0.08]} position={[s * (N.door + 0.05), FY + 1.3, N.z1 + N.door / 2 + 0.1]} rotation={[0, s * (Math.PI / 2), 0]} color="#9a6a42" />
      ))}
      {/* 屋頂（室內淡出） */}
      <FadeGroup>
        <group position={[0, FY + h, cz]} rotation={[0, Math.PI / 2, 0]}>
          <RoofPanels length={depth + 1} width={width + 1.2} rise={2.5} />
        </group>
        <GableRoof width={width + 0.3} depth={0.3} height={2.4} position={[0, FY + h, N.z0]} color={STONE} />
      </FadeGroup>
    </group>
  );
}

/** 斜屋頂兩片 */
function RoofPanels({ length, width, rise }: { length: number; width: number; rise: number }) {
  const half = width / 2;
  const slope = Math.atan2(rise, half);
  const panel = Math.hypot(half, rise) + 0.2;
  return (
    <group>
      {[-1, 1].map((s) => (
        <Box key={s} size={[length, 0.18, panel]} position={[0, rise / 2, (s * half) / 2]} rotation={[s * slope, 0, 0]} color={ROOF} />
      ))}
      <Box size={[length, 0.16, 0.24]} position={[0, rise + 0.02, 0]} color="#7f97b3" />
    </group>
  );
}

/** 鐘樓：敲鐘時鐘體擺動 */
function Tower() {
  const { x, z, hw, hd } = CHURCH.tower;
  const bell = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = (performance.now() - worldStore.get().bellAt) / 1000;
    if (bell.current) bell.current.rotation.x = s < 4 ? Math.sin(s * 6) * 0.35 * Math.exp(-s * 0.9) : 0;
  });
  const th = 6.2;
  return (
    <group position={[x, 0, z]}>
      <Box size={[hw * 2, th, hd * 2]} position={[0, th / 2, 0]} color={STONE} />
      <Box size={[hw * 2 + 0.2, 0.25, hd * 2 + 0.2]} position={[0, th, 0]} color={TRIM} />
      {/* 鐘室 */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([a, b], i) => (
        <Box key={i} size={[0.35, 2, 0.35]} position={[a * (hw - 0.17), th + 1.1, b * (hd - 0.17)]} color={STONE} />
      ))}
      <Box size={[hw * 2 + 0.2, 0.25, hd * 2 + 0.2]} position={[0, th + 2.2, 0]} color={TRIM} />
      <group ref={bell} position={[0, th + 1.9, 0]}>
        <Cyl args={[0.3, 0.52, 0.85, 16]} position={[0, -0.5, 0]} color="#c9a04e" metalness={0.6} roughness={0.35} />
        <Sphere r={0.3} position={[0, -0.08, 0]} scale={[1, 0.6, 1]} color="#c9a04e" metalness={0.6} roughness={0.35} />
      </group>
      <Cone r={1.55} h={3} seg={4} position={[0, th + 3.8, 0]} rotation={[0, Math.PI / 4, 0]} color={ROOF} />
      {/* 十字架 */}
      <group position={[0, th + 5.8, 0]}>
        <Box size={[0.12, 1, 0.12]} color="#d9b25a" metalness={0.4} />
        <Box size={[0.6, 0.12, 0.12]} position={[0, 0.15, 0]} color="#d9b25a" metalness={0.4} />
      </group>
      {/* 鐘繩 */}
      <Cyl args={[0.02, 0.02, 1.8, 4]} position={[0.4, 1.6, hd + 0.05]} color="#c9b48a" shadow={false} />
      <Sphere r={0.06} position={[0.4, 0.7, hd + 0.05]} color="#b5543c" shadow={false} />
      {/* 拱門裝飾 */}
      <Box size={[1, 1.8, 0.05]} position={[0, 0.9, hd + 0.01]} color="#a87c55" />
    </group>
  );
}

function Pews() {
  return (
    <group>
      {CHURCH.pews.xs.flatMap((x) =>
        CHURCH.pews.zs.map((z) => (
          <group key={`${x}${z}`} position={[x, FY, z]}>
            <Box size={[CHURCH.pews.hw * 2, 0.08, 0.42]} position={[0, 0.45, -0.02]} color="#a8754a" />
            <Box size={[CHURCH.pews.hw * 2, 0.55, 0.07]} position={[0, 0.72, 0.2]} rotation={[-0.08, 0, 0]} color="#9a6a42" />
            {[-1, 1].map((s) => (
              <Box key={s} size={[0.08, 0.9, 0.48]} position={[s * (CHURCH.pews.hw - 0.04), 0.45, 0]} color="#8a5c38" />
            ))}
          </group>
        )),
      )}
    </group>
  );
}

function AltarArea() {
  const { x, z } = CHURCH.altar;
  const dark = isDark(usePhase());
  const fy = FY + CHURCH.chancel.h;
  return (
    <group>
      <group position={[x, fy, z]}>
        <Box size={[2.4, 0.95, 0.75]} position={[0, 0.48, 0]} color="#f7f2e8" />
        <Box size={[2.5, 0.06, 0.82]} position={[0, 0.98, 0]} color="#e2c48b" />
        <Box size={[0.6, 0.85, 0.02]} position={[0, 0.5, 0.385]} color="#c8a85c" />
        {/* 燭台 */}
        {[-0.85, 0.85].map((dx) => (
          <group key={dx} position={[dx, 1.01, 0]}>
            <Cyl args={[0.1, 0.12, 0.05, 10]} position={[0, 0.02, 0]} color="#d4b062" metalness={0.5} roughness={0.35} />
            <Cyl args={[0.025, 0.03, 0.4, 8]} position={[0, 0.22, 0]} color="#d4b062" metalness={0.5} roughness={0.35} />
            <Cyl args={[0.04, 0.04, 0.22, 8]} position={[0, 0.53, 0]} color="#fbf6ea" shadow={false} />
            <Sphere r={0.03} position={[0, 0.68, 0]} scale={[1, 1.7, 1]} color="#ffd27a" emissive="#ffb347" emissiveIntensity={2.4} shadow={false} />
            <Glow position={[0, 0.69, 0]} color="#ffbf66" size={dark ? 0.9 : 0.5} opacity={0.6} />
          </group>
        ))}
        {/* 花束 */}
        {[-0.35, 0.35].map((dx) => (
          <group key={dx} position={[dx, 1.01, -0.1]}>
            <Cyl args={[0.07, 0.09, 0.22, 10]} position={[0, 0.11, 0]} color="#e8eef3" />
            {['#ffffff', '#f6c1cc', '#fbe7a0', '#c9e2b5'].map((c, i) => (
              <Sphere key={i} r={0.075} position={[Math.cos(i * 1.6) * 0.07, 0.3 + (i % 2) * 0.05, Math.sin(i * 1.6) * 0.07]} color={c} />
            ))}
          </group>
        ))}
      </group>
      {/* 牆上十字架 */}
      <group position={[0, fy + 2.4, N.z0 + 0.2]}>
        <Box size={[0.22, 1.7, 0.1]} color="#a3764a" />
        <Box size={[1, 0.22, 0.1]} position={[0, 0.3, 0]} color="#a3764a" />
        <mesh position={[0, 0.2, -0.04]}>
          <circleGeometry args={[1.1, 32]} />
          <meshStandardMaterial color="#fff3d1" emissive="#ffe7a8" emissiveIntensity={0.35} transparent opacity={0.6} />
        </mesh>
      </group>
      {/* 祭壇兩側花台 */}
      {[-2.2, 2.2].map((x2) => (
        <group key={x2} position={[x2, fy, N.z0 + 0.6]}>
          <Cyl args={[0.18, 0.22, 0.9, 10]} position={[0, 0.45, 0]} color="#e9e2d4" />
          {['#ffffff', '#f6c1cc', '#c9e2b5', '#fbe7a0', '#ffffff'].map((c, i) => (
            <Sphere key={i} r={0.13} position={[Math.cos(i * 1.3) * 0.15, 1.0 + (i % 2) * 0.1, Math.sin(i * 1.3) * 0.15]} color={c} />
          ))}
        </group>
      ))}
    </group>
  );
}

/** 祝福蠟燭架：點亮時燭火由暗漸亮 */
function CandleStand() {
  const { x, z } = CHURCH.candles;
  const lit = useWorld((s) => s.litCandles);
  return (
    <group position={[x, FY + CHURCH.chancel.h, z]}>
      <Box size={[1, 0.8, 0.6]} position={[0, 0.4, 0]} color="#8a5c38" />
      <Box size={[1.05, 0.06, 0.65]} position={[0, 0.82, 0]} color="#d4b062" metalness={0.4} />
      <Box size={[1, 0.25, 0.22]} position={[0, 0.98, -0.2]} color="#8a5c38" />
      {CHURCH_CANDLE_IDS.map((id, i) => {
        const row = Math.floor(i / 5);
        const col = i % 5;
        return <Candle key={id} position={[-0.38 + col * 0.19 + row * 0.09, row ? 1.11 : 0.85, row ? -0.2 : 0.1]} lit={lit.includes(id)} />;
      })}
    </group>
  );
}

function Candle({ position, lit }: { position: [number, number, number]; lit: boolean }) {
  const flame = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Sprite>(null);
  const level = useRef(0);
  useFrame(({ clock }, dt) => {
    level.current += ((lit ? 1 : 0) - level.current) * (1 - Math.exp(-dt * 1.8));
    const f = level.current * (0.9 + Math.sin(clock.getElapsedTime() * 13 + position[0] * 20) * 0.1);
    if (flame.current) {
      flame.current.scale.set(f, f * 1.8, f);
      flame.current.visible = level.current > 0.02;
    }
    if (glow.current) (glow.current.material as THREE.SpriteMaterial).opacity = level.current * 0.6;
  });
  return (
    <group position={position}>
      <Cyl args={[0.035, 0.035, 0.16, 8]} position={[0, 0.08, 0]} color="#fbf6ea" shadow={false} />
      <mesh ref={flame} position={[0, 0.19, 0]} visible={false}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#ffd27a" emissive="#ffb347" emissiveIntensity={3} />
      </mesh>
      <sprite ref={glow} position={[0, 0.2, 0]} scale={[0.45, 0.45, 0.45]}>
        <spriteMaterial map={getGlowTexture()} color="#ffbf66" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}

function Piano() {
  const { x, z } = CHURCH.piano;
  return (
    <group position={[x, FY + CHURCH.chancel.h, z]} rotation={[0, -0.25, 0]}>
      <Box size={[1.4, 1.05, 0.6]} position={[0, 0.6, -0.1]} color="#3b302c" roughness={0.35} />
      <Box size={[1.3, 0.06, 0.28]} position={[0, 0.78, 0.3]} color="#3b302c" roughness={0.35} />
      <Box size={[1.2, 0.03, 0.18]} position={[0, 0.82, 0.32]} color="#f8f6f0" />
      {Array.from({ length: 10 }, (_, i) => (
        <Box key={i} size={[0.05, 0.03, 0.1]} position={[-0.52 + i * 0.115, 0.845, 0.28]} color="#222" shadow={false} />
      ))}
      {[-0.6, 0.6].map((dx) => (
        <Box key={dx} size={[0.08, 0.75, 0.08]} position={[dx, 0.38, 0.3]} color="#3b302c" />
      ))}
      <Box size={[0.8, 0.45, 0.35]} position={[0, 0.23, 0.85]} color="#5a4038" />
    </group>
  );
}

function InteriorLight() {
  const dark = isDark(usePhase());
  return (
    <group>
      <pointLight position={[0, FY + 3, -9]} color="#fff0d6" intensity={dark ? 32 : 12} distance={15} decay={1.6} />
      <pointLight position={[0, FY + 2.4, -14.2]} color="#ffd9a0" intensity={dark ? 16 : 6} distance={6} decay={1.6} />
      {/* 吊燈 */}
      {[-6.5, -10.5].map((z) => (
        <group key={z} position={[0, FY + 3.1, z]}>
          <Cyl args={[0.01, 0.01, 0.8, 4]} position={[0, 0.5, 0]} color="#444" shadow={false} />
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.4, 0.03, 6, 20]} />
            <meshStandardMaterial color="#c9a04e" metalness={0.5} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return <Sphere key={i} r={0.045} position={[Math.cos(a) * 0.4, 0.08, Math.sin(a) * 0.4]} color="#fff3c4" emissive="#ffd27a" emissiveIntensity={dark ? 2.5 : 0.8} shadow={false} />;
          })}
        </group>
      ))}
    </group>
  );
}

/** 今日祝福看板（預設為原創祝福；管理員可在後台發布每日一句） */
function BlessingBoard() {
  const { x, z } = CHURCH.board;
  const tex = useMemo(() => {
    const msg = dailyMessage('church');
    const wrapped = Array.from(msg).reduce<string[]>((lines, ch) => {
      const last = lines[lines.length - 1];
      if (!last || Array.from(last).length >= 9) lines.push(ch);
      else lines[lines.length - 1] = last + ch;
      return lines;
    }, []);
    return textTexture(['今日祝福', ...wrapped].join('\n'), { bg: '#3f5a46', fg: '#fbf6ea', border: '#c9a96e', w: 512, h: 512, font: 52 });
  }, []);
  return (
    <group position={[x, 0, z]}>
      {[-0.45, 0.45].map((dx) => (
        <Box key={dx} size={[0.08, 1.7, 0.08]} position={[dx, 0.85, 0]} color="#8a5c38" />
      ))}
      <mesh position={[0, 1.25, 0.05]} castShadow>
        <boxGeometry args={[1.1, 1.1, 0.06]} />
        <meshStandardMaterial attach="material-0" color="#8a5c38" />
        <meshStandardMaterial attach="material-1" color="#8a5c38" />
        <meshStandardMaterial attach="material-2" color="#8a5c38" />
        <meshStandardMaterial attach="material-3" color="#8a5c38" />
        <meshStandardMaterial attach="material-4" map={tex} />
        <meshStandardMaterial attach="material-5" color="#8a5c38" />
      </mesh>
    </group>
  );
}

function Garden() {
  const dark = isDark(usePhase());
  return (
    <group>
      {/* 噴水池 */}
      <group position={[0, 0, 3.2]}>
        <Cyl args={[1.2, 1.3, 0.4, 20]} position={[0, 0.2, 0]} color="#e6e0d4" />
        <Cyl args={[1.0, 1.0, 0.05, 20]} position={[0, 0.38, 0]} color="#8ec3d4" roughness={0.15} />
        <Cyl args={[0.15, 0.2, 0.9, 10]} position={[0, 0.7, 0]} color="#e6e0d4" />
        <Cyl args={[0.45, 0.3, 0.12, 14]} position={[0, 1.15, 0]} color="#e6e0d4" />
        <Sphere r={0.12} position={[0, 1.32, 0]} color="#bfe3ee" emissive="#bfe3ee" emissiveIntensity={0.3} />
      </group>
      {/* 花園拱門 */}
      <group position={[0, 0, 6.6]}>
        {[-1.3, 1.3].map((x) => (
          <Box key={x} size={[0.12, 2.2, 0.12]} position={[x, 1.1, 0]} color="#f4efe6" />
        ))}
        <mesh position={[0, 2.2, 0]}>
          <torusGeometry args={[1.3, 0.07, 6, 20, Math.PI]} />
          <meshStandardMaterial color="#f4efe6" />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => {
          const a = (i / 8) * Math.PI;
          return <Sphere key={i} r={0.13} position={[Math.cos(a) * 1.3, 2.2 + Math.sin(a) * 1.3, 0.05]} color={i % 2 ? '#f6c1cc' : '#9cc58b'} />;
        })}
      </group>
      {/* 花圃矮籬 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[4.6, 0.25, 0.1]} position={[s * 4.6, 0.12, 0.3]} color="#f4efe6" />
          <Box size={[4.6, 0.25, 0.1]} position={[s * 4.6, 0.12, 4.9]} color="#f4efe6" />
        </group>
      ))}
      {/* 庭園燈 */}
      {[-2.2, 2.2].flatMap((x) =>
        [0.5, 8.5, 15].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <Cyl args={[0.04, 0.06, 1.4, 6]} position={[0, 0.7, 0]} color="#4a4f57" />
            <Sphere r={0.14} position={[0, 1.5, 0]} color="#fff3c4" emissive="#ffd27a" emissiveIntensity={dark ? 2 : 0.3} shadow={false} />
            {dark && <Glow position={[0, 1.5, 0]} color="#ffcf80" size={1.4} opacity={0.5} />}
          </group>
        )),
      )}
    </group>
  );
}
