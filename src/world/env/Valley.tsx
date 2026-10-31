import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BRIDGE, PAVILION, STREAM, STREAM_BENCH, WATERFALL, mulberry32, type TreeData, type Vegetation } from '../layouts/valley';
import { Ball, Bench, Box, Cone, Cyl, Glow, getGlowTexture } from './prims';
import { isDark, usePhase } from './useDayPhase';
import { windMaterial, windUniforms } from './wind';
import { FadeGroup } from './FadeGroup';
import { worldStore } from '../worldStore';

const tmpObj = new THREE.Object3D();

/* ------------------------------ 地形 ------------------------------ */

/** 山谷地面：中央平坦可行走，外圍逐漸隆起成丘陵，與遠山相接 */
export function Ground() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(420, 420, 140, 140);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const rnd = mulberry32(7);
    const c = new THREE.Color();
    const base = new THREE.Color('#9dbf83');
    const dry = new THREE.Color('#b8c98a');
    const deep = new THREE.Color('#78a26f');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = Math.hypot(x, z);
      const rise = THREE.MathUtils.smoothstep(d, 38, 110);
      const n = Math.sin(x * 0.11) * Math.cos(z * 0.09) + Math.sin(x * 0.033 + z * 0.05) * 1.6;
      const y = rise * (10 + n * 5) + (d > 36 ? (rnd() - 0.5) * 0.4 * rise : 0);
      pos.setY(i, y - 0.02);
      c.copy(base).lerp(rnd() < 0.5 ? dry : deep, 0.25 + rnd() * 0.35);
      c.lerp(deep, rise * 0.5);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} flatShading />
    </mesh>
  );
}

/** 層疊山脈：近山深綠、遠山霧藍，配合霧化呈現空氣遠近感 */
export function Mountains({ low }: { low: boolean }) {
  const layers = useMemo(() => {
    const rnd = mulberry32(42);
    const defs = [
      { r: [105, 130], h: [26, 42], color: '#6e9874', n: low ? 16 : 26 },
      { r: [150, 185], h: [45, 70], color: '#86a69a', n: low ? 14 : 22 },
      { r: [210, 250], h: [70, 110], color: '#a7bccb', n: low ? 12 : 18 },
    ];
    return defs.map((d) =>
      Array.from({ length: d.n }, (_, i) => {
        const a = (i / d.n) * Math.PI * 2 + rnd() * 0.25;
        const r = d.r[0] + rnd() * (d.r[1] - d.r[0]);
        const h = d.h[0] + rnd() * (d.h[1] - d.h[0]);
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, h, w: h * (0.9 + rnd() * 0.6), color: d.color, rot: rnd() * Math.PI };
      }),
    );
  }, [low]);
  return (
    <group>
      {layers.flat().map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]} rotation={[0, m.rot, 0]}>
          <mesh position={[0, m.h / 2 - 2, 0]} scale={[m.w, m.h, m.w * 0.8]}>
            <coneGeometry args={[1, 1, 7, 2]} />
            <meshStandardMaterial color={m.color} flatShading roughness={1} />
          </mesh>
          {m.h > 80 && (
            <mesh position={[0, m.h - 2 - m.h * 0.09, 0]} scale={[m.w * 0.19, m.h * 0.19, m.w * 0.15]}>
              <coneGeometry args={[1, 1, 7, 1]} />
              <meshStandardMaterial color="#f2f5f7" flatShading roughness={1} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** 山間雲霧：柔光精靈緩慢漂移 */
export function Mist({ reduceMotion, low }: { reduceMotion: boolean; low: boolean }) {
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo(() => {
    const rnd = mulberry32(99);
    return Array.from({ length: low ? 14 : 30 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = 60 + rnd() * 120;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 6 + rnd() * 16, s: 40 + rnd() * 50, speed: 0.3 + rnd() * 0.6, phase: rnd() * 10 };
    });
  }, [low]);
  const phase = usePhase();
  useFrame(({ clock }) => {
    if (reduceMotion || !group.current) return;
    const t = clock.getElapsedTime();
    group.current.children.forEach((c, i) => {
      const p = puffs[i];
      c.position.x = p.x + Math.sin(t * 0.02 * p.speed + p.phase) * 12;
    });
  });
  const color = phase === 'night' ? '#5d6b8f' : phase === 'dusk' ? '#f2c3a8' : phase === 'dawn' ? '#fbe1d2' : '#ffffff';
  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <sprite key={i} position={[p.x, p.y, p.z]} scale={[p.s, p.s * 0.35, 1]}>
          <spriteMaterial map={getGlowTexture()} color={color} transparent opacity={phase === 'night' ? 0.25 : 0.5} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

function Cloud({ position, scale = 1, speed = 0.3, color }: { position: [number, number, number]; scale?: number; speed?: number; color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.x = position[0] + Math.sin(clock.getElapsedTime() * speed * 0.05) * 14;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      <Ball r={2.2} detail={1} color={color} shadow={false} />
      <Ball r={1.7} detail={1} position={[2.3, -0.4, 0.3]} color={color} shadow={false} />
      <Ball r={1.5} detail={1} position={[-2.2, -0.5, -0.2]} color={color} shadow={false} />
    </group>
  );
}

export function Clouds() {
  const phase = usePhase();
  const color = phase === 'night' ? '#55628a' : phase === 'dusk' ? '#f6cdb4' : '#ffffff';
  return (
    <group>
      <Cloud position={[-60, 34, -70]} scale={2} color={color} />
      <Cloud position={[55, 40, -90]} scale={2.4} speed={0.5} color={color} />
      <Cloud position={[80, 30, 20]} scale={1.6} color={color} />
      <Cloud position={[-85, 36, 40]} scale={2} speed={0.4} color={color} />
      <Cloud position={[10, 46, -130]} scale={3} color={color} />
    </group>
  );
}

/* ------------------------------ 水景 ------------------------------ */

function stripeTexture(vertical: boolean) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.globalAlpha = 1;
  g.fillRect(0, 0, 64, 256);
  const rnd = mulberry32(vertical ? 3 : 4);
  for (let i = 0; i < 40; i++) {
    g.globalAlpha = 0.25 + rnd() * 0.5;
    g.fillStyle = '#ffffff';
    const x = rnd() * 64;
    const y = rnd() * 256;
    g.fillRect(x, y, 2 + rnd() * 4, 20 + rnd() * 50);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function Stream({ reduceMotion }: { reduceMotion: boolean }) {
  const phase = usePhase();
  const tex = useMemo(() => {
    const t = stripeTexture(false);
    t.rotation = Math.PI / 2;
    t.repeat.set(1, 18);
    return t;
  }, []);
  const fallTex = useMemo(() => {
    const t = stripeTexture(true);
    t.repeat.set(2, 1.5);
    return t;
  }, []);
  useFrame((_, dt) => {
    if (reduceMotion) return;
    tex.offset.y -= dt * 0.05;
    fallTex.offset.y += dt * 0.9;
  });
  const len = STREAM.x1 - STREAM.x0;
  const water = phase === 'night' ? '#36557a' : phase === 'dusk' ? '#8fa5b8' : '#86c0cf';
  return (
    <group>
      {/* 河床與水面 */}
      <mesh position={[(STREAM.x0 + STREAM.x1) / 2, 0.01, STREAM.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[len, STREAM.halfWidth * 2 + 0.7]} />
        <meshStandardMaterial color="#a89a7c" roughness={1} />
      </mesh>
      <mesh position={[(STREAM.x0 + STREAM.x1) / 2, 0.06, STREAM.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[len, STREAM.halfWidth * 2]} />
        <meshStandardMaterial color={water} roughness={0.15} metalness={0.15} transparent opacity={0.88} map={tex} />
      </mesh>
      {/* 拱橋 */}
      <Bridge />
      {/* 瀑布山壁 */}
      <group position={[WATERFALL.x, 0, WATERFALL.z]}>
        {[
          [-3, 4, -5, 5, 9],
          [-3.5, 3.5, 5, 5, 8],
          [-2.8, 7.5, 0, 4, 6],
          [-4.5, 3, 0, 5, 7],
          [-2, 1.2, -7.5, 3.5, 3],
          [-2, 1.2, 7.5, 3.5, 3],
        ].map(([x, y, z, s, sy], i) => (
          <mesh key={i} position={[x, y, z]} scale={[s, sy, s]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={i % 2 ? '#8e8a80' : '#7f7b72'} flatShading roughness={1} />
          </mesh>
        ))}
        {[
          [-2.5, 9.8, -4, 2.2],
          [-3, 9.3, 4.5, 2.4],
          [-2.4, 12.3, 0.6, 1.9],
        ].map(([x, y, z, s], i) => (
          <mesh key={`m${i}`} position={[x, y, z]} scale={[s, s * 0.5, s]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#6f9a5e" flatShading />
          </mesh>
        ))}
        {/* 落水 */}
        <mesh position={[0.75, WATERFALL.top / 2 + 0.6, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[2.6, WATERFALL.top + 0.8]} />
          <meshStandardMaterial color={water} map={fallTex} transparent opacity={0.85} roughness={0.2} side={THREE.DoubleSide} emissive={water} emissiveIntensity={0.15} />
        </mesh>
        {/* 水潭與水花 */}
        <mesh position={[2.2, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[3, 24]} />
          <meshStandardMaterial color={water} roughness={0.15} transparent opacity={0.9} />
        </mesh>
        <Splash reduceMotion={reduceMotion} />
      </group>
    </group>
  );
}

function Splash({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current || reduceMotion) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((c, i) => {
      const s = 0.8 + Math.sin(t * 3 + i * 1.7) * 0.25;
      c.scale.setScalar(s);
    });
  });
  return (
    <group ref={ref} position={[1.1, 0.3, 0]}>
      {[-0.9, -0.3, 0.3, 0.9].map((z, i) => (
        <mesh key={i} position={[0, 0.1 + (i % 2) * 0.1, z]}>
          <icosahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.85} flatShading />
        </mesh>
      ))}
      <sprite position={[0.6, 1.2, 0]} scale={[6, 3, 1]}>
        <spriteMaterial map={getGlowTexture()} transparent opacity={0.45} depthWrite={false} />
      </sprite>
    </group>
  );
}

function Bridge() {
  const { x, z, halfWidth: hw, halfLength: hl, h } = BRIDGE;
  const planks = 12;
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: planks }, (_, i) => {
        const t = (i + 0.5) / planks;
        const pz = -hl + t * hl * 2;
        const y = Math.cos((pz / hl) * (Math.PI / 2)) * h;
        const slope = -Math.sin((pz / hl) * (Math.PI / 2)) * h * (Math.PI / 2) / hl;
        return <Box key={i} size={[hw * 2, 0.1, (hl * 2) / planks + 0.02]} position={[0, y, pz]} rotation={[-Math.atan(slope), 0, 0]} color={i % 2 ? '#b5875c' : '#a97c52'} />;
      })}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (hw + 0.05), 0, 0]}>
          {[-1, -0.5, 0, 0.5, 1].map((t) => {
            const pz = t * hl * 0.95;
            const y = Math.cos(((pz / hl) * Math.PI) / 2) * h;
            return <Cyl key={t} args={[0.06, 0.07, 0.75, 6]} position={[0, y + 0.35, pz]} color="#8a5f3c" />;
          })}
          {Array.from({ length: 8 }, (_, i) => {
            const a = -1 + (i + 0.5) / 4;
            const pz = a * hl * 0.95;
            const y = Math.cos(((pz / hl) * Math.PI) / 2) * h;
            return <Box key={i} size={[0.07, 0.07, (hl * 2 * 0.95) / 8 + 0.04]} position={[0, y + 0.7, pz]} color="#c49466" />;
          })}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------ 植被（InstancedMesh） ------------------------------ */

function useInstances(ref: React.RefObject<THREE.InstancedMesh>, items: TreeData[], y = 0, tilt = false) {
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((t, i) => {
      tmpObj.position.set(t.x, y, t.z);
      tmpObj.rotation.set(tilt ? t.rot * 0.2 : 0, tilt ? 0 : t.rot, tilt ? t.rot : 0);
      tmpObj.scale.setScalar(t.s);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [ref, items, y, tilt]);
}

export function VegetationMeshes({ veg, low }: { veg: Vegetation; low: boolean }) {
  const pines = useMemo(() => (low ? veg.pines.filter((_, i) => i % 3 !== 2) : veg.pines), [veg, low]);
  const round = useMemo(() => (low ? veg.round.filter((_, i) => i % 3 !== 2) : veg.round), [veg, low]);
  const geos = useMemo(() => {
    const pineLeaf = mergeGeometries([
      new THREE.ConeGeometry(1.3, 1.8, 7).translate(0, 1.6, 0),
      new THREE.ConeGeometry(1.0, 1.5, 7).translate(0, 2.5, 0),
      new THREE.ConeGeometry(0.65, 1.2, 7).translate(0, 3.3, 0),
    ])!;
    const trunk = new THREE.CylinderGeometry(0.14, 0.22, 1.2, 6).translate(0, 0.6, 0);
    const roundLeaf = mergeGeometries([
      new THREE.IcosahedronGeometry(1.2, 0).translate(0, 2.1, 0),
      new THREE.IcosahedronGeometry(0.85, 0).translate(0.7, 1.7, 0.2),
      new THREE.IcosahedronGeometry(0.75, 0).translate(-0.6, 1.8, -0.3),
    ])!;
    const stalkParts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.06, 0.07, 5, 6).translate(0, 2.5, 0)];
    for (let i = 1; i < 6; i++) stalkParts.push(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 6).translate(0, i * 0.85, 0));
    const stalk = mergeGeometries(stalkParts)!;
    const leafParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      leafParts.push(
        new THREE.ConeGeometry(0.09, 0.8, 3)
          .rotateZ(Math.PI / 2 + 0.5)
          .rotateY(a)
          .translate(Math.cos(a) * 0.35, 3.4 + (i % 3) * 0.5, -Math.sin(a) * 0.35),
      );
    }
    const bambooLeaf = mergeGeometries(leafParts)!;
    return { pineLeaf, trunk, roundLeaf, stalk, bambooLeaf, stem: new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4).translate(0, 0.15, 0), bloom: new THREE.IcosahedronGeometry(0.09, 0).translate(0, 0.32, 0), rock: new THREE.DodecahedronGeometry(1, 0) };
  }, []);
  const mats = useMemo(
    () => ({
      pine: windMaterial('#4f8a5b', 0.012),
      round: windMaterial('#7fae6a', 0.012),
      trunk: new THREE.MeshStandardMaterial({ color: '#8a6446', flatShading: true }),
      stalk: windMaterial('#8fb45f', 0.006),
      bambooLeaf: windMaterial('#6f9f4f', 0.006),
      stem: new THREE.MeshStandardMaterial({ color: '#5f8d4e' }),
      bloom: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true }),
      rock: new THREE.MeshStandardMaterial({ color: '#9c968a', flatShading: true }),
    }),
    [],
  );
  const pineLeaf = useRef<THREE.InstancedMesh>(null);
  const pineTrunk = useRef<THREE.InstancedMesh>(null);
  const roundLeaf = useRef<THREE.InstancedMesh>(null);
  const roundTrunk = useRef<THREE.InstancedMesh>(null);
  const stalks = useRef<THREE.InstancedMesh>(null);
  const bLeaves = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const blooms = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);
  useInstances(pineLeaf, pines);
  useInstances(pineTrunk, pines);
  useInstances(roundLeaf, round);
  useInstances(roundTrunk, round);
  useInstances(stalks, veg.bamboo, 0, true);
  useInstances(bLeaves, veg.bamboo, 0, true);
  useInstances(stems, veg.flowers);
  useInstances(blooms, veg.flowers);
  useInstances(rocks, veg.rocks, 0.05);
  useEffect(() => {
    const m = blooms.current;
    if (!m) return;
    const palette = ['#f7d36b', '#f4a7b9', '#ffffff', '#c7a6e6', '#f6a46a'].map((c) => new THREE.Color(c));
    veg.flowers.forEach((f, i) => m.setColorAt(i, palette[f.c]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [veg]);

  useFrame(({ clock }) => {
    windUniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <group>
      <instancedMesh ref={pineLeaf} args={[geos.pineLeaf, mats.pine, pines.length]} castShadow={!low} receiveShadow />
      <instancedMesh ref={pineTrunk} args={[geos.trunk, mats.trunk, pines.length]} castShadow={!low} />
      <instancedMesh ref={roundLeaf} args={[geos.roundLeaf, mats.round, round.length]} castShadow={!low} receiveShadow />
      <instancedMesh ref={roundTrunk} args={[geos.trunk, mats.trunk, round.length]} castShadow={!low} />
      {veg.bamboo.length > 0 && (
        <>
          <instancedMesh ref={stalks} args={[geos.stalk, mats.stalk, veg.bamboo.length]} castShadow={!low} />
          <instancedMesh ref={bLeaves} args={[geos.bambooLeaf, mats.bambooLeaf, veg.bamboo.length]} castShadow={!low} />
        </>
      )}
      <instancedMesh ref={stems} args={[geos.stem, mats.stem, veg.flowers.length]} />
      <instancedMesh ref={blooms} args={[geos.bloom, mats.bloom, veg.flowers.length]} />
      <instancedMesh ref={rocks} args={[geos.rock, mats.rock, veg.rocks.length]} castShadow={!low} receiveShadow />
    </group>
  );
}

/* ------------------------------ 涼亭與長椅 ------------------------------ */

export function Pavilion({ variant, rot }: { variant: 'wood' | 'white'; rot: number }) {
  const dark = isDark(usePhase());
  const post = variant === 'wood' ? '#8f5b3a' : '#f4efe6';
  const roof = variant === 'wood' ? '#5d6b5a' : '#a9c0d6';
  return (
    <group position={[PAVILION.x, 0, PAVILION.z]}>
      <Cyl args={[2.5, 2.6, 0.2, 6]} position={[0, 0.1, 0]} color={variant === 'wood' ? '#c9b89a' : '#ece6da'} />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        return <Cyl key={i} args={[0.11, 0.13, 2.6, 8]} position={[Math.cos(a) * 1.9, 1.5, Math.sin(a) * 1.9]} color={post} />;
      })}
      <FadeGroup hide={() => worldStore.get().seat?.id === 'pavilion'}>
        <Cone r={3.2} h={1.5} seg={6} position={[0, 3.45, 0]} color={roof} />
        <Cone r={0.35} h={0.6} seg={6} position={[0, 4.4, 0]} color={variant === 'wood' ? '#c9a24a' : '#ffffff'} />
      </FadeGroup>
      {variant === 'wood' && (
        <>
          <Box size={[0.3, 0.42, 0.3]} position={[0, 0.41, 0]} color="#8a6446" />
          <Cyl args={[0.08, 0.08, 0.4, 6]} position={[0, 2.6, 0]} color="#8a6446" />
          <Ball r={0.22} detail={1} position={[0, 2.3, 0]} color="#e46a4b" emissive="#ff9b5c" emissiveIntensity={dark ? 1.6 : 0.2} />
          {dark && <Glow position={[0, 2.3, 0]} color="#ffb070" size={2.2} />}
        </>
      )}
      <group rotation={[0, rot, 0]}>
        <Bench position={[0, 0.2 - 0.2, -0.05]} rotation={[0, Math.PI, 0]} color={variant === 'wood' ? '#a97c52' : '#f6f1e7'} />
      </group>
    </group>
  );
}

export function StreamBench() {
  return <Bench position={[STREAM_BENCH.x, 0, STREAM_BENCH.z]} rotation={[0, 0, 0]} />;
}

/** 主步道踏石 */
export function SteppingStones({ fromZ, toZ }: { fromZ: number; toZ: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const stones = useMemo(() => {
    const rnd = mulberry32(11);
    const out: TreeData[] = [];
    for (let z = fromZ; z < toZ; z += 0.75) {
      if (Math.abs(z - STREAM.z) < STREAM.halfWidth + 1.2) continue;
      out.push({ x: (rnd() - 0.5) * 0.5 + Math.sin(z * 0.25) * 0.4, z, s: 0.45 + rnd() * 0.15, rot: rnd() * Math.PI });
    }
    return out;
  }, [fromZ, toZ]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    stones.forEach((s, i) => {
      tmpObj.position.set(s.x, 0.02, s.z);
      tmpObj.rotation.set(0, s.rot, 0);
      tmpObj.scale.set(s.s * 1.3, 0.06, s.s);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [stones]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, stones.length]} receiveShadow>
      <cylinderGeometry args={[1, 1, 1, 7]} />
      <meshStandardMaterial color="#d8cfbd" flatShading roughness={1} />
    </instancedMesh>
  );
}

/* ------------------------------ 小動物與自然動態 ------------------------------ */

function Bird({ radius, height, speed, phase, center }: { radius: number; height: number; speed: number; phase: number; center: [number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const wl = useRef<THREE.Mesh>(null);
  const wr = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const a = t * speed + phase;
    if (ref.current) {
      ref.current.position.set(center[0] + Math.cos(a) * radius, height + Math.sin(a * 2) * 1.2, center[1] + Math.sin(a) * radius);
      ref.current.rotation.y = -a - (speed > 0 ? 0 : Math.PI);
    }
    const f = Math.sin(t * 9 + phase) * 0.6;
    if (wl.current) wl.current.rotation.z = f;
    if (wr.current) wr.current.rotation.z = -f;
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshStandardMaterial color="#5b6170" />
      </mesh>
      <mesh ref={wl} position={[0.02, 0, 0]}>
        <boxGeometry args={[0.04, 0.02, 0.45]} />
        <meshStandardMaterial color="#6d7383" />
      </mesh>
      <mesh ref={wr} position={[-0.02, 0, 0]}>
        <boxGeometry args={[0.04, 0.02, 0.45]} />
        <meshStandardMaterial color="#6d7383" />
      </mesh>
    </group>
  );
}

function Butterfly({ center, color, phase }: { center: [number, number]; color: string; phase: number }) {
  const ref = useRef<THREE.Group>(null);
  const wl = useRef<THREE.Mesh>(null);
  const wr = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.6 + phase;
    if (ref.current) {
      const x = center[0] + Math.sin(t * 1.3) * 2.2 + Math.sin(t * 3.1) * 0.4;
      const z = center[1] + Math.cos(t * 0.9) * 1.8;
      const y = 0.9 + Math.sin(t * 2.7) * 0.35;
      ref.current.lookAt(x, y, z);
      ref.current.position.set(x, y, z);
    }
    const f = Math.sin(clock.getElapsedTime() * 18 + phase) * 1.1;
    if (wl.current) wl.current.rotation.z = 0.2 + f * 0.5;
    if (wr.current) wr.current.rotation.z = -0.2 - f * 0.5;
  });
  return (
    <group ref={ref}>
      <mesh ref={wl} position={[0.05, 0, 0]}>
        <planeGeometry args={[0.18, 0.14]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh ref={wr} position={[-0.05, 0, 0]}>
        <planeGeometry args={[0.18, 0.14]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} emissive={color} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

/** 飄落的樹葉（實例化，循環回收） */
function Leaves({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const rnd = mulberry32(5);
    return Array.from({ length: count }, () => ({ x: (rnd() - 0.5) * 50, y: rnd() * 9, z: (rnd() - 0.5) * 50, sp: 0.35 + rnd() * 0.4, ph: rnd() * 10 }));
  }, [count]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const palette = ['#e0a84d', '#cf7f45', '#b9c25d', '#e9c46a'].map((c) => new THREE.Color(c));
    data.forEach((_, i) => m.setColorAt(i, palette[i % palette.length]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data]);
  useFrame(({ clock }, dt) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.getElapsedTime();
    data.forEach((d, i) => {
      d.y -= d.sp * dt;
      if (d.y < 0.05) d.y = 7 + Math.random() * 3;
      tmpObj.position.set(d.x + Math.sin(t * 0.8 + d.ph) * 0.8, d.y, d.z + Math.cos(t * 0.6 + d.ph) * 0.5);
      tmpObj.rotation.set(t * 1.5 + d.ph, t + d.ph, 0);
      tmpObj.scale.setScalar(1);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[0.16, 0.1]} />
      <meshStandardMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

export function Fauna({ reduceMotion, low, butterflyZones }: { reduceMotion: boolean; low: boolean; butterflyZones: [number, number][] }) {
  const phase = usePhase();
  if (reduceMotion) return null;
  const day = phase === 'day' || phase === 'dawn';
  return (
    <group>
      {phase !== 'night' &&
        [0, 1, 2, 3].map((i) => <Bird key={i} radius={24 + i * 3} height={14 + i * 1.5} speed={0.12 + i * 0.015} phase={i * 0.4} center={[0, -4]} />)}
      {phase !== 'night' && !low && [0, 1, 2].map((i) => <Bird key={`b${i}`} radius={40} height={22} speed={-0.08} phase={i * 0.25 + 2} center={[10, -20]} />)}
      {day &&
        butterflyZones.flatMap((c, zi) =>
          ['#f7d36b', '#f4a7b9', '#c7d8f5'].slice(0, low ? 1 : 3).map((col, i) => <Butterfly key={`${zi}-${i}`} center={c} color={col} phase={zi * 3 + i * 2.1} />),
        )}
      {!low && <Leaves count={phase === 'night' ? 12 : 36} />}
    </group>
  );
}
