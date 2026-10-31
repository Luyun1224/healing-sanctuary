import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TEMPLE, TEMPLE_LAMP_IDS, templeVegetation } from '../layouts/temple';
import { pavilion } from '../layouts/valley';
import { Fauna, Pavilion, SteppingStones, StreamBench, VegetationMeshes } from '../env/Valley';
import { Ball, Box, Cone, Cyl, Glow, HipRoof, Sphere, getGlowTexture } from '../env/prims';
import { FadeGroup } from '../env/FadeGroup';
import { Offering } from './Offering';
import { latticeTexture, textTexture } from '../env/textures';
import { isDark, usePhase } from '../env/useDayPhase';
import { useWorld, worldStore } from '../worldStore';

const WOOD = '#a0623e';
const WOOD_DARK = '#7b4a2f';
const WALL = '#efe2c8';
const ROOF = '#55615c';
const GOLD = '#d9a944';

const P = TEMPLE.platform;
const H = TEMPLE.hall;
const FY = P.h;

/** 靜心佛堂場景（建築、室內陳設、鐘亭、涼亭、竹林） */
export function TempleScene({ low, reduceMotion }: { low: boolean; reduceMotion: boolean }) {
  return (
    <group>
      <Hall />
      <Buddha />
      <Altar />
      <WoodenFish />
      {TEMPLE.cushions.map(([x, z], i) => (
        <Cushion key={i} x={x} z={z} />
      ))}
      <PeaceLamps />
      <Offering variant="temple" position={[TEMPLE.offering.x, FY, TEMPLE.offering.z]} rotationY={-Math.PI / 2 + 0.75} />
      <InteriorLight />
      <BellPavilion />
      <Courtyard />
      <Pavilion variant="wood" rot={pavilion('').rot} />
      <StreamBench />
      <SteppingStones fromZ={0.5} toZ={24} />
      <VegetationMeshes veg={templeVegetation} low={low} />
      <Fauna reduceMotion={reduceMotion} low={low} butterflyZones={[[-4.2, 3.5], [4.2, 3.5], [11, 6]]} />
    </group>
  );
}

function Hall() {
  const lattice = useMemo(() => {
    const t = latticeTexture('#f3e6cc', '#8a5534').clone();
    t.repeat.set(3, 2);
    t.needsUpdate = true;
    return t;
  }, []);
  const plaque = useMemo(() => textTexture('靜心堂', { bg: '#5a2f1f', fg: '#f2cf6b', border: '#d9a944', w: 512, h: 180, font: 104 }), []);
  const wallH = H.height;
  const midY = FY + wallH / 2;
  const width = H.x1 - H.x0;
  const depth = H.z1 - H.z0;
  const frontSeg = H.x1 - H.door;
  return (
    <group>
      {/* 石砌台基與木地板 */}
      <Box size={[P.hw * 2, P.h, P.hd * 2]} position={[P.x, P.h / 2, P.z]} color="#cfc6b4" />
      <Box size={[width, 0.04, depth]} position={[0, FY + 0.02, (H.z0 + H.z1) / 2]} color="#c99d6c" shadow={false} />
      {Array.from({ length: 12 }, (_, i) => (
        <Box key={i} size={[0.02, 0.045, depth]} position={[H.x0 + (i + 0.5) * (width / 12), FY + 0.022, (H.z0 + H.z1) / 2]} color="#b48858" shadow={false} />
      ))}
      {/* 石階 */}
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[4.8, P.h - i * (P.h / 3), 0.4]} position={[0, (P.h - i * (P.h / 3)) / 2, P.z + P.hd + 0.2 + i * 0.4]} color="#d8d0bf" />
      ))}

      {/* 牆面 */}
      <Box size={[width + 0.3, wallH, 0.3]} position={[0, midY, H.z0]} color={WALL} />
      <Box size={[0.3, wallH, depth]} position={[H.x0, midY, (H.z0 + H.z1) / 2]} color={WALL} />
      <Box size={[0.3, wallH, depth]} position={[H.x1, midY, (H.z0 + H.z1) / 2]} color={WALL} />
      {/* 正面：底部矮牆保留，上方木格門與匾額在室內時淡出 */}
      {[-1, 1].map((s) => (
        <Box key={s} size={[frontSeg, 0.6, 0.24]} position={[s * (H.door + frontSeg / 2), FY + 0.3, H.z1]} color={WOOD} />
      ))}
      <FadeGroup>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * (H.door + frontSeg / 2), FY + 1.75, H.z1]} castShadow receiveShadow>
              <boxGeometry args={[frontSeg, 2.3, 0.2]} />
              <meshStandardMaterial map={lattice} roughness={0.9} />
            </mesh>
            <Box size={[frontSeg, 0.25, 0.24]} position={[s * (H.door + frontSeg / 2), FY + wallH - 0.125, H.z1]} color={WOOD} />
          </group>
        ))}
        <Box size={[H.door * 2, 0.7, 0.24]} position={[0, FY + wallH - 0.35, H.z1]} color={WOOD} />
        <mesh position={[0, FY + wallH + 0.15, H.z1 + 0.6]} rotation={[-0.08, 0, 0]}>
          <boxGeometry args={[2.4, 0.84, 0.08]} />
          <meshStandardMaterial attach="material-0" color="#5a2f1f" />
          <meshStandardMaterial attach="material-1" color="#5a2f1f" />
          <meshStandardMaterial attach="material-2" color="#5a2f1f" />
          <meshStandardMaterial attach="material-3" color="#5a2f1f" />
          <meshStandardMaterial attach="material-4" map={plaque} emissive="#3a2010" emissiveIntensity={0.2} />
          <meshStandardMaterial attach="material-5" color="#5a2f1f" />
        </mesh>
        <Box size={[14, 0.3, 0.3]} position={[0, FY + wallH - 0.05, -1.95]} color={WOOD_DARK} />
      </FadeGroup>
      {/* 柱子：牆角與前廊 */}
      {[
        [H.x0, H.z0],
        [H.x1, H.z0],
        [H.x0, H.z1],
        [H.x1, H.z1],
        [-H.door, H.z1],
        [H.door, H.z1],
      ].map(([x, z], i) => (
        <Cyl key={i} args={[0.2, 0.22, wallH, 10]} position={[x, midY, z]} color={WOOD} />
      ))}
      {[-6.6, -3.4, 3.4, 6.6].map((x) => (
        <group key={x}>
          <Cyl args={[0.17, 0.19, wallH + 0.1, 10]} position={[x, FY + (wallH + 0.1) / 2, -1.95]} color={WOOD} />
          <Cyl args={[0.28, 0.3, 0.16, 10]} position={[x, FY + 0.08, -1.95]} color="#cfc6b4" />
        </group>
      ))}
      <EaveLanterns />
      {/* 屋頂（進入室內時淡出） */}
      <FadeGroup>
        <Box size={[width + 0.6, 0.35, depth + 0.6]} position={[0, FY + wallH + 0.17, (H.z0 + H.z1) / 2]} color={WOOD_DARK} />
        <HipRoof width={17.2} depth={14.4} height={2.1} position={[0, FY + wallH + 0.25, -7.6]} color={ROOF} />
        <Box size={[7.5, 0.9, 4.6]} position={[0, FY + wallH + 2.1, -7.6]} color={WOOD} />
        <HipRoof width={10.5} depth={7.2} height={1.8} position={[0, FY + wallH + 2.5, -7.6]} color={ROOF} />
        <Box size={[4.2, 0.22, 0.26]} position={[0, FY + wallH + 4.25, -7.6]} color={GOLD} />
        <Sphere r={0.24} position={[0, FY + wallH + 4.5, -7.6]} color={GOLD} metalness={0.4} roughness={0.4} />
      </FadeGroup>
    </group>
  );
}

function EaveLanterns() {
  const dark = isDark(usePhase());
  return (
    <group>
      {[-5, -1.7, 1.7, 5].map((x) => (
        <group key={x} position={[x, FY + H.height - 0.75, -1.95]}>
          <Cyl args={[0.01, 0.01, 0.4, 4]} position={[0, 0.45, 0]} color="#333" shadow={false} />
          <Sphere r={0.24} scale={[1, 1.15, 1]} color="#e0553f" emissive="#ff8a55" emissiveIntensity={dark ? 1.7 : 0.25} shadow={false} />
          <Cyl args={[0.12, 0.12, 0.06, 8]} position={[0, 0.28, 0]} color={GOLD} shadow={false} />
          <Cyl args={[0.12, 0.12, 0.06, 8]} position={[0, -0.28, 0]} color={GOLD} shadow={false} />
          {dark && <Glow position={[0, 0, 0.05]} color="#ffaa66" size={1.8} opacity={0.55} />}
        </group>
      ))}
    </group>
  );
}

function InteriorLight() {
  const phase = usePhase();
  const dark = isDark(phase);
  return (
    <group>
      <pointLight position={[0, FY + 2.6, -8.5]} color="#ffd6a0" intensity={dark ? 30 : 12} distance={14} decay={1.6} />
      <pointLight position={[0, FY + 2.2, -11]} color="#ffcf8a" intensity={dark ? 14 : 6} distance={6} decay={1.6} />
      {/* 室內吊燈籠 */}
      {[
        [-3.5, -5.5],
        [3.5, -5.5],
        [-3.5, -10],
        [3.5, -10],
      ].map(([x, z], i) => (
        <group key={i} position={[x, FY + 2.55, z]}>
          <Cyl args={[0.01, 0.01, 0.5, 4]} position={[0, 0.5, 0]} color="#333" shadow={false} />
          <Cyl args={[0.2, 0.2, 0.42, 8]} color="#f6e2b0" emissive="#ffcf7a" emissiveIntensity={dark ? 1.4 : 0.35} shadow={false} />
        </group>
      ))}
    </group>
  );
}

/** 佛像：莊重簡潔的坐姿造型（低多邊形），蓮花座與背光 */
function Buddha() {
  const { x, z } = TEMPLE.buddha;
  const gold = '#d8ae55';
  return (
    <group position={[x, FY, z]}>
      <Box size={[3.2, 0.7, 1.7]} position={[0, 0.35, -0.2]} color="#8a4f30" />
      <Box size={[3.4, 0.08, 1.9]} position={[0, 0.72, -0.2]} color={GOLD} />
      {/* 蓮花座 */}
      <group position={[0, 0.85, -0.2]}>
        <Cyl args={[0.75, 0.6, 0.3, 16]} color="#c58c6e" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <Sphere key={i} r={0.22} position={[Math.cos(a) * 0.72, 0.12, Math.sin(a) * 0.72]} scale={[0.6, 1, 0.35]} rotation={[0, -a, 0.3]} color="#e6a6a0" />;
        })}
      </group>
      {/* 坐像 */}
      <group position={[0, 1.05, -0.25]}>
        <Sphere r={0.62} position={[0, 0.15, 0.05]} scale={[1.15, 0.38, 0.85]} color={gold} metalness={0.35} roughness={0.45} />
        <Sphere r={0.5} position={[0, 0.72, 0]} scale={[0.95, 1.15, 0.75]} color={gold} metalness={0.35} roughness={0.45} />
        <Sphere r={0.18} position={[0, 0.42, 0.38]} scale={[1.3, 0.6, 0.6]} color={gold} metalness={0.35} roughness={0.45} />
        <Sphere r={0.32} position={[0, 1.48, 0]} color={gold} metalness={0.35} roughness={0.45} />
        <Sphere r={0.15} position={[0, 1.78, -0.02]} color="#6a5130" />
        <Sphere r={0.08} position={[0.31, 1.42, 0]} scale={[0.6, 1.6, 0.6]} color={gold} />
        <Sphere r={0.08} position={[-0.31, 1.42, 0]} scale={[0.6, 1.6, 0.6]} color={gold} />
        {/* 背光 */}
        <mesh position={[0, 1.2, -0.45]}>
          <ringGeometry args={[0.55, 1.05, 40]} />
          <meshStandardMaterial color="#f4d58a" emissive="#f4c662" emissiveIntensity={0.55} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.2, -0.46]}>
          <circleGeometry args={[0.55, 40]} />
          <meshStandardMaterial color="#f8e7b4" emissive="#f4d58a" emissiveIntensity={0.35} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function Altar() {
  const { x, z } = TEMPLE.altar;
  const dark = isDark(usePhase());
  return (
    <group position={[x, FY, z]}>
      <Box size={[2.6, 0.08, 0.75]} position={[0, 0.82, 0]} color="#8a4f30" />
      <Box size={[2.4, 0.78, 0.6]} position={[0, 0.39, 0]} color="#a35b33" />
      <Box size={[2.42, 0.4, 0.04]} position={[0, 0.5, 0.31]} color={GOLD} />
      {/* 香爐與香 */}
      <Cyl args={[0.2, 0.16, 0.22, 12]} position={[0, 0.97, 0]} color="#8d7a52" metalness={0.5} roughness={0.4} />
      {[-0.06, 0, 0.06].map((dx) => (
        <group key={dx}>
          <Cyl args={[0.008, 0.008, 0.4, 4]} position={[dx, 1.25, 0]} color="#b5543c" shadow={false} />
          <Sphere r={0.012} position={[dx, 1.45, 0]} color="#ff7a3c" emissive="#ff5a1c" emissiveIntensity={2} shadow={false} />
        </group>
      ))}
      <IncenseSmoke position={[0, 1.5, 0]} />
      {/* 供花 */}
      {[-0.85, 0.85].map((dx) => (
        <group key={dx} position={[dx, 0.86, 0]}>
          <Cyl args={[0.08, 0.1, 0.28, 10]} position={[0, 0.14, 0]} color="#e9e3d6" />
          <Ball r={0.11} position={[0, 0.36, 0]} color="#f4b6c2" />
          <Ball r={0.09} position={[0.1, 0.33, 0.04]} color="#fbe7a0" />
          <Ball r={0.09} position={[-0.09, 0.34, -0.04]} color="#ffffff" />
        </group>
      ))}
      {/* 小燭台 */}
      {[-0.45, 0.45].map((dx) => (
        <group key={dx} position={[dx, 0.86, 0.12]}>
          <Cyl args={[0.035, 0.035, 0.18, 8]} position={[0, 0.09, 0]} color="#f6efe0" shadow={false} />
          <Sphere r={0.025} position={[0, 0.21, 0]} scale={[1, 1.6, 1]} color="#ffd27a" emissive="#ffb347" emissiveIntensity={2} shadow={false} />
          {dark && <Glow position={[0, 0.22, 0]} color="#ffbf66" size={0.5} />}
        </group>
      ))}
    </group>
  );
}

function IncenseSmoke({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.children.forEach((c, i) => {
      const k = ((t * 0.25 + i / 4) % 1 + 1) % 1;
      c.position.set(Math.sin(t + i) * 0.05 * k * 4, k * 0.9, 0);
      c.scale.setScalar(0.15 + k * 0.35);
      ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = 0.35 * (1 - k);
    });
  });
  return (
    <group ref={ref} position={position}>
      {[0, 1, 2, 3].map((i) => (
        <sprite key={i}>
          <spriteMaterial color="#e8e4dc" transparent opacity={0.3} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

/** 木魚：敲擊時輕微震動 */
function WoodenFish() {
  const { x, z } = TEMPLE.fish;
  const fish = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = fish.current;
    if (!g) return;
    const s = (performance.now() - worldStore.get().lastStrike) / 1000;
    const k = s < 0.3 ? Math.sin(s * 60) * 0.03 * (1 - s / 0.3) : 0;
    g.scale.set(1 + k, 1 - k, 1 + k);
    g.rotation.z = k * 0.5;
  });
  return (
    <group position={[x, FY, z]}>
      {/* 底座與墊布 */}
      <Box size={[0.75, 0.32, 0.6]} position={[0, 0.16, 0]} color="#7b4a2f" />
      <Cyl args={[0.32, 0.36, 0.08, 16]} position={[0, 0.36, 0]} color="#b8462e" />
      <group ref={fish} position={[0, 0.56, 0]}>
        <Sphere r={0.28} scale={[1.05, 0.85, 1]} color="#a2552c" roughness={0.45} />
        {/* 魚口 */}
        <mesh position={[0, -0.03, 0.27]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.36, 0.035, 0.06]} />
          <meshStandardMaterial color="#3a1e10" />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.24, 0.015, 6, 24]} />
          <meshStandardMaterial color="#d9a944" />
        </mesh>
      </group>
      {/* 跪坐用蒲團 */}
      <Cyl args={[0.32, 0.34, 0.14, 18]} position={[0, 0.07, 0.8]} color="#b5793f" />
    </group>
  );
}

function Cushion({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, FY, z]}>
      <Cyl args={[0.36, 0.38, 0.14, 20]} position={[0, 0.07, 0]} color="#d08a3c" />
      <mesh position={[0, 0.145, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.24, 24]} />
        <meshStandardMaterial color="#a8642a" />
      </mesh>
    </group>
  );
}

/** 平安燈：點亮時由暗漸亮 */
function PeaceLamps() {
  const { x, z } = TEMPLE.lamps;
  const lit = useWorld((s) => s.litLamps);
  return (
    <group position={[x, FY, z]}>
      <Box size={[0.7, 0.5, 3.6]} position={[0.05, 0.25, 0]} color="#7b4a2f" />
      <Box size={[0.5, 0.45, 3.6]} position={[0.15, 0.72, 0]} color="#8a5534" />
      <Box size={[0.12, 2, 3.8]} position={[0.32, 1, 0]} color="#6b3d24" />
      {TEMPLE_LAMP_IDS.map((id, i) => {
        const row = i < 4 ? 0 : 1;
        const zz = -1.35 + (i % 4) * 0.9;
        return <Lamp key={id} position={[row ? 0.15 : -0.12, row ? 0.95 : 0.5, zz]} lit={lit.includes(id)} />;
      })}
    </group>
  );
}

function Lamp({ position, lit }: { position: [number, number, number]; lit: boolean }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useRef<THREE.Sprite>(null);
  const level = useRef(0);
  useFrame((_, dt) => {
    level.current += ((lit ? 1 : 0) - level.current) * (1 - Math.exp(-dt * 1.4));
    if (mat.current) mat.current.emissiveIntensity = 0.05 + level.current * 2.2;
    if (glow.current) {
      (glow.current.material as THREE.SpriteMaterial).opacity = level.current * 0.7;
      glow.current.visible = level.current > 0.02;
    }
  });
  return (
    <group position={position}>
      {/* 蓮花燈 */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return <Sphere key={i} r={0.09} position={[Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1]} scale={[0.6, 1, 0.4]} rotation={[0, -a, 0.4]} color="#f2b8c0" shadow={false} />;
      })}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial ref={mat} color="#ffe2a0" emissive="#ffb347" emissiveIntensity={0.05} />
      </mesh>
      <sprite ref={glow} position={[0, 0.14, 0]} scale={[0.8, 0.8, 0.8]} visible={false}>
        <spriteMaterial map={getGlowTexture()} color="#ffc56b" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}

/** 鐘亭：敲鐘時鐘體擺動 */
function BellPavilion() {
  const { x, z } = TEMPLE.bell;
  const bell = useRef<THREE.Group>(null);
  useFrame(() => {
    const s = (performance.now() - worldStore.get().bellAt) / 1000;
    if (bell.current) bell.current.rotation.x = s < 4 ? Math.sin(s * 5) * 0.12 * Math.exp(-s * 1.1) : 0;
  });
  return (
    <group position={[x, 0, z]}>
      <Box size={[2.6, 0.3, 2.6]} position={[0, 0.15, 0]} color="#cfc6b4" />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([px, pz], i) => (
        <Cyl key={i} args={[0.12, 0.14, 3, 8]} position={[px, 1.8, pz]} color={WOOD} />
      ))}
      <Box size={[2.4, 0.2, 0.2]} position={[0, 3.2, 0]} color={WOOD_DARK} />
      <HipRoof width={3.6} depth={3.6} height={1.3} position={[0, 3.3, 0]} color={ROOF} />
      <group ref={bell} position={[0, 3.1, 0]}>
        <Cyl args={[0.04, 0.04, 0.3, 6]} position={[0, -0.1, 0]} color="#5a4a3a" />
        <Cyl args={[0.42, 0.55, 1.25, 18]} position={[0, -0.85, 0]} color="#6f7a63" metalness={0.5} roughness={0.5} />
        <Sphere r={0.42} position={[0, -0.25, 0]} scale={[1, 0.5, 1]} color="#6f7a63" metalness={0.5} roughness={0.5} />
        <mesh position={[0, -0.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.025, 6, 24]} />
          <meshStandardMaterial color="#8a956f" metalness={0.5} />
        </mesh>
      </group>
      {/* 撞木 */}
      <group position={[0, 2.2, 1.05]}>
        <Cyl args={[0.012, 0.012, 0.9, 4]} position={[-0.7, 0.45, 0]} color="#333" shadow={false} />
        <Cyl args={[0.012, 0.012, 0.9, 4]} position={[0.7, 0.45, 0]} color="#333" shadow={false} />
        <Cyl args={[0.1, 0.1, 1.5, 8]} rotation={[0, 0, Math.PI / 2]} color="#b38a5e" />
      </group>
    </group>
  );
}

function Courtyard() {
  const dark = isDark(usePhase());
  return (
    <group>
      {/* 庭院大香爐 */}
      <group position={[0, 0, 0.9]}>
        <Cyl args={[0.4, 0.5, 0.25, 8]} position={[0, 0.12, 0]} color="#8d7a52" metalness={0.4} />
        <Cyl args={[0.48, 0.36, 0.5, 12]} position={[0, 0.5, 0]} color="#8d7a52" metalness={0.4} roughness={0.5} />
        <Cone r={0.38} h={0.4} seg={8} position={[0, 0.95, 0]} color="#7a6845" metalness={0.4} />
      </group>
      {/* 石燈籠 */}
      {[-2.2, 2.2].flatMap((x) =>
        [4.5, 15.5].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <Box size={[0.4, 0.15, 0.4]} position={[0, 0.07, 0]} color="#b9b3a6" />
            <Cyl args={[0.1, 0.12, 0.7, 6]} position={[0, 0.5, 0]} color="#c7c1b4" />
            <Box size={[0.42, 0.38, 0.42]} position={[0, 1.04, 0]} color="#d3cdc0" emissive="#ffcf7a" emissiveIntensity={dark ? 0.9 : 0} />
            <Cone r={0.42} h={0.3} seg={4} position={[0, 1.38, 0]} rotation={[0, Math.PI / 4, 0]} color="#a9a397" />
            {dark && <Glow position={[0, 1.04, 0]} color="#ffbf70" size={1.6} opacity={0.5} />}
          </group>
        )),
      )}
    </group>
  );
}
