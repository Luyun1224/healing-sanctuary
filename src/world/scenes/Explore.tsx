import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CAT, POND, WISH_TREE, mulberry32 } from '../layouts/valley';
import { Ball, Box, Cone, Cyl, Sphere } from '../env/prims';
import { player, useWorld, worldStore } from '../worldStore';
import { useSettings } from '../settings';

/**
 * Phase 4 山林探索（兩個場景共用）：貓咪、錦鯉池、祈願樹、蝴蝶、煩惱樹葉、細雨。
 * 每個互動都有實際的動畫回饋，而不只是顯示名稱。
 */
export function Explore() {
  return (
    <group>
      <Cat />
      <Pond />
      <WishTree />
      <ButterflySwarm />
      <WorryLeaves />
      <Rain />
    </group>
  );
}

/** 曬太陽的貓咪：平常輕輕呼吸、甩尾巴；被摸時抬頭、閉眼、呼嚕並冒出愛心 */
function Cat() {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const eyesOpen = useRef<THREE.Group>(null);
  const eyesShut = useRef<THREE.Group>(null);
  const petAt = useWorld((s) => s.catPetAt);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const since = (performance.now() - worldStore.get().catPetAt) / 1000;
    const purring = since < 4;
    if (body.current) body.current.scale.y = 1 + Math.sin(t * (purring ? 9 : 1.4)) * (purring ? 0.04 : 0.025);
    if (tail.current) tail.current.rotation.y = Math.sin(t * (purring ? 3 : 1)) * (purring ? 0.6 : 0.25);
    if (head.current) {
      const lift = purring ? 0.35 : 0;
      head.current.rotation.x += (-lift - head.current.rotation.x) * 0.08;
      head.current.rotation.z = purring ? Math.sin(t * 2) * 0.12 : 0;
    }
    const closed = purring || Math.sin(t * 0.3) > 0.7;
    if (eyesOpen.current) eyesOpen.current.visible = !closed;
    if (eyesShut.current) eyesShut.current.visible = closed;
  });
  const fur = '#e9a65c';
  const light = '#fbe3c4';
  return (
    <group position={[CAT.x, 0, CAT.z]} rotation={[0, -0.6, 0]}>
      {/* 小毯子 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[0.55, 24]} />
        <meshStandardMaterial color="#c9d7e8" />
      </mesh>
      <group ref={body}>
        <Sphere r={0.24} position={[0, 0.17, 0]} scale={[1, 0.7, 1.35]} color={fur} />
        <Sphere r={0.14} position={[0, 0.16, 0.12]} scale={[1, 0.6, 1]} color={light} />
        {[-0.1, 0.1].map((x) => (
          <Sphere key={x} r={0.06} position={[x, 0.05, 0.28]} scale={[1, 0.6, 1.3]} color={light} />
        ))}
      </group>
      <group ref={head} position={[0, 0.27, 0.32]}>
        <Sphere r={0.15} color={fur} />
        <Sphere r={0.08} position={[0, -0.04, 0.1]} scale={[1.2, 0.8, 0.8]} color={light} />
        {[-0.08, 0.08].map((x) => (
          <Cone key={x} r={0.05} h={0.09} seg={3} position={[x, 0.14, -0.01]} rotation={[0, 0, x > 0 ? -0.2 : 0.2]} color={fur} />
        ))}
        <group ref={eyesOpen}>
          {[-0.055, 0.055].map((x) => (
            <Sphere key={x} r={0.022} position={[x, 0.02, 0.135]} scale={[1, 1.3, 0.6]} color="#2d2622" shadow={false} />
          ))}
        </group>
        <group ref={eyesShut} visible={false}>
          {[-0.055, 0.055].map((x) => (
            <mesh key={x} position={[x, 0.015, 0.14]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.02, 0.006, 5, 10, Math.PI]} />
              <meshBasicMaterial color="#2d2622" />
            </mesh>
          ))}
        </group>
        <Sphere r={0.016} position={[0, -0.03, 0.16]} color="#e98a8a" shadow={false} />
      </group>
      <group ref={tail} position={[0, 0.1, -0.3]}>
        <Cyl args={[0.035, 0.03, 0.4, 6]} position={[0.12, 0, -0.12]} rotation={[Math.PI / 2, 0, 0.9]} color={fur} />
      </group>
      {performance.now() - petAt < 4000 && (
        <Html position={[0, 0.7, 0.3]} center pointerEvents="none">
          <div key={petAt} className="hearts pointer-events-none text-lg">
            <span>💗</span>
            <span>💕</span>
            <span>💗</span>
          </div>
        </Html>
      )}
    </group>
  );
}

/** 錦鯉池：平常繞圈游；餵食後魚游向飼料落點，水面出現漣漪 */
function Pond() {
  const fish = useRef<THREE.Group>(null);
  const ripples = useRef<THREE.Group>(null);
  const pellets = useRef<THREE.Group>(null);
  const koi = useMemo(() => {
    const rnd = mulberry32(31);
    return Array.from({ length: 6 }, (_, i) => ({ r: 0.6 + rnd() * 1.0, speed: 0.25 + rnd() * 0.3, phase: rnd() * Math.PI * 2, color: ['#f08a3c', '#ffffff', '#e2553b', '#f6c14b', '#ffffff', '#f08a3c'][i] }));
  }, []);
  // 飼料落點：靠近岸邊互動點那一側
  const feed = useMemo(() => new THREE.Vector3(-1.3, 0, 0), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const since = (performance.now() - worldStore.get().pondFeedAt) / 1000;
    const feeding = since < 8;
    fish.current?.children.forEach((g, i) => {
      const k = koi[i];
      const a = t * k.speed + k.phase;
      const home = tmp.set(Math.cos(a) * k.r, 0, Math.sin(a) * k.r);
      const target = feeding ? feed.clone().add(new THREE.Vector3(Math.cos(i * 1.7 + t) * 0.35, 0, Math.sin(i * 1.3 + t) * 0.35)) : home;
      const prev = g.position.clone();
      g.position.lerp(target, 1 - Math.exp(-dt * (feeding ? 2.2 : 3)));
      const dx = g.position.x - prev.x;
      const dz = g.position.z - prev.z;
      if (Math.abs(dx) + Math.abs(dz) > 1e-4) g.rotation.y = Math.atan2(dx, dz);
      g.children[1].rotation.y = Math.sin(t * 8 + i) * 0.5;
    });
    ripples.current?.children.forEach((r, i) => {
      const s = since - i * 0.5;
      const on = s > 0 && s < 3;
      r.visible = on;
      if (on) {
        r.scale.setScalar(0.2 + s * 0.5);
        ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - s / 3);
      }
    });
    pellets.current?.children.forEach((p, i) => {
      const s = since - 0.1 - i * 0.05;
      p.visible = s > 0 && s < 5;
      if (p.visible) p.position.y = Math.max(0.12, 0.8 - s * 3);
    });
  });
  return (
    <group position={[POND.x, 0, POND.z]}>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return <Ball key={i} r={0.32} detail={0} position={[Math.cos(a) * POND.r, 0.12, Math.sin(a) * POND.r]} scale={[1, 0.6, 1]} color={i % 2 ? '#a8a194' : '#bdb6a8'} />;
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <circleGeometry args={[POND.r - 0.1, 32]} />
        <meshStandardMaterial color="#6fa8b8" roughness={0.15} transparent opacity={0.92} />
      </mesh>
      {[
        [0.8, 0.6],
        [-0.4, -1.1],
        [1.1, -0.5],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.1, z]}>
          <mesh rotation={[-Math.PI / 2, 0, i]}>
            <circleGeometry args={[0.25, 12, 0.3, Math.PI * 1.8]} />
            <meshStandardMaterial color="#6f9f4f" side={THREE.DoubleSide} />
          </mesh>
          {i === 0 && <Sphere r={0.08} position={[0.05, 0.06, 0]} scale={[1, 0.7, 1]} color="#f6c1cc" shadow={false} />}
        </group>
      ))}
      <group ref={fish} position={[0, 0.06, 0]}>
        {koi.map((k, i) => (
          <group key={i}>
            <Sphere r={0.1} scale={[0.6, 0.45, 1.5]} color={k.color} shadow={false} />
            <group position={[0, 0, -0.15]}>
              <Cone r={0.06} h={0.12} seg={3} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.04]} color={k.color} shadow={false} />
            </group>
          </group>
        ))}
      </group>
      <group ref={ripples} position={[feed.x, 0.11, feed.z]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.9, 1, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group ref={pellets} position={[feed.x, 0, feed.z]}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[Math.cos(i * 2.1) * 0.25, 0.8, Math.sin(i * 1.7) * 0.25]} visible={false}>
            <sphereGeometry args={[0.025, 6, 4]} />
            <meshStandardMaterial color="#c08a4a" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** 祈願樹：掛上的祝福會以彩色布條出現在樹上並隨風擺動 */
function WishTree() {
  const wishes = useWorld((s) => s.wishes);
  const ribbons = useRef<THREE.Group>(null);
  const spots = useMemo(() => {
    const rnd = mulberry32(77);
    return Array.from({ length: 24 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = 0.9 + rnd() * 0.9;
      return [Math.cos(a) * r, 2.0 + rnd() * 0.7, Math.sin(a) * r] as [number, number, number];
    });
  }, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ribbons.current?.children.forEach((c, i) => {
      c.rotation.z = Math.sin(t * 1.6 + i) * 0.25;
    });
  });
  const colors = ['#e2553b', '#f6c14b', '#f4a7b9', '#9cc5e8', '#b9e0a5'];
  return (
    <group position={[WISH_TREE.x, 0, WISH_TREE.z]}>
      <Cyl args={[0.28, 0.42, 2.4, 8]} position={[0, 1.2, 0]} color="#8a6446" />
      <Ball r={1.6} detail={1} position={[0, 3, 0]} color="#7fae6a" />
      <Ball r={1.1} detail={1} position={[1, 2.6, 0.4]} color="#8cbc75" />
      <Ball r={1.1} detail={1} position={[-0.9, 2.7, -0.4]} color="#77a663" />
      <Box size={[0.9, 0.5, 0.06]} position={[0.9, 0.7, 0.9]} rotation={[0, -0.6, 0]} color="#f3e6cc" />
      {/* 原本就掛著的布條 */}
      <group ref={ribbons}>
        {[...spots.slice(0, 6).map((p, i) => ({ p, c: colors[i % colors.length], mine: false })), ...wishes.map((_, i) => ({ p: spots[6 + (i % 18)], c: colors[(i + 2) % colors.length], mine: true }))].map((r, i) => (
          <group key={i} position={r.p}>
            <Cyl args={[0.008, 0.008, 0.2, 3]} position={[0, -0.1, 0]} color="#7a5a3e" shadow={false} />
            <Box size={[0.09, r.mine ? 0.42 : 0.32, 0.01]} position={[0, -0.36, 0]} color={r.c} emissive={r.mine ? r.c : undefined} emissiveIntensity={r.mine ? 0.35 : 0} shadow={false} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** 欣賞蝴蝶：一群蝴蝶飛到玩家身邊環繞約 12 秒 */
function ButterflySwarm() {
  const at = useWorld((s) => s.butterflyAt);
  const group = useRef<THREE.Group>(null);
  const center = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const since = (performance.now() - at) / 1000;
    g.visible = at > 0 && since < 12;
    if (!g.visible) return;
    center.lerp(player.pos, 0.05);
    const t = clock.getElapsedTime();
    const enter = Math.min(1, since / 2);
    const leave = since > 10 ? (since - 10) * 3 : 0;
    g.children.forEach((b, i) => {
      const a = t * (0.8 + i * 0.07) + i * 1.1;
      const r = (0.8 + (i % 3) * 0.3) * (2 - enter) + leave;
      b.position.set(center.x + Math.cos(a) * r, center.y + 1 + Math.sin(t * 2 + i) * 0.3 + leave * 0.5, center.z + Math.sin(a) * r);
      b.rotation.y = -a;
      const f = Math.sin(t * 18 + i) * 0.9;
      (b.children[0] as THREE.Object3D).rotation.z = 0.2 + f * 0.5;
      (b.children[1] as THREE.Object3D).rotation.z = -0.2 - f * 0.5;
    });
  });
  const cols = ['#f7d36b', '#f4a7b9', '#c7d8f5', '#ffffff', '#f6a46a', '#c7a6e6'];
  return (
    <group ref={group} visible={false}>
      {cols.map((c, i) => (
        <group key={i}>
          {[0.05, -0.05].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <planeGeometry args={[0.16, 0.13]} />
              <meshStandardMaterial color={c} side={THREE.DoubleSide} emissive={c} emissiveIntensity={0.3} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** 煩惱寄放所：寫著煩惱的樹葉從玩家身邊緩緩飄向山谷，最後淡出 */
function WorryLeaves() {
  const leaves = useWorld((s) => s.leaves);
  return (
    <>
      {leaves.map((l) => (
        <Leaf key={l.id} text={l.text} at={l.at} />
      ))}
    </>
  );
}

function Leaf({ text, at }: { text: string; at: number }) {
  const ref = useRef<THREE.Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const start = useMemo(() => player.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), []);
  const dir = useMemo(() => new THREE.Vector3(-0.6, 0, 1).normalize(), []);
  useFrame(() => {
    const s = (performance.now() - at) / 1000;
    const g = ref.current;
    if (!g) return;
    g.position.set(start.x + dir.x * s * 2.2 + Math.sin(s * 1.6) * 0.6, start.y + s * 0.9 + Math.sin(s * 2.3) * 0.2, start.z + dir.z * s * 2.2);
    g.rotation.set(Math.sin(s * 1.3) * 0.5, s * 0.8, Math.sin(s * 1.9) * 0.4);
    const fade = s < 5 ? 1 : Math.max(0, 1 - (s - 5) / 2);
    if (label.current) label.current.style.opacity = String(fade);
    g.scale.setScalar(Math.max(0.01, fade));
  });
  return (
    <group ref={ref}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <circleGeometry args={[0.35, 4]} />
        <meshStandardMaterial color="#9cc58b" side={THREE.DoubleSide} emissive="#9cc58b" emissiveIntensity={0.2} />
      </mesh>
      <Html center pointerEvents="none">
        <div ref={label} className="max-w-[180px] rounded-xl bg-[#eaf3e2]/90 px-2 py-1 text-center text-xs font-medium text-forest shadow">
          🍃 {text}
        </div>
      </Html>
    </group>
  );
}

/** 細雨：開啟「細雨聲」時一併顯示雨絲（只在玩家附近產生） */
function Rain() {
  const on = useSettings((s) => s.rain);
  const low = useSettings((s) => s.quality === 'low');
  const reduce = useSettings((s) => s.reduceMotion);
  const count = low ? 250 : 700;
  const ref = useRef<THREE.InstancedMesh>(null);
  const drops = useMemo(() => {
    const rnd = mulberry32(9);
    return Array.from({ length: count }, () => ({ x: (rnd() - 0.5) * 30, y: rnd() * 12, z: (rnd() - 0.5) * 30, v: 9 + rnd() * 4 }));
  }, [count]);
  const obj = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m || !on) return;
    drops.forEach((d, i) => {
      d.y -= d.v * Math.min(dt, 0.05) * (reduce ? 0.3 : 1);
      if (d.y < 0) d.y += 12;
      obj.position.set(player.pos.x + d.x, d.y, player.pos.z + d.z);
      obj.updateMatrix();
      m.setMatrixAt(i, obj.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  if (!on) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[0.01, 0.35, 0.01]} />
      <meshBasicMaterial color="#cfe0ea" transparent opacity={0.5} />
    </instancedMesh>
  );
}
