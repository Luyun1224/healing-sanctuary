import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '../../data/avatar';
import type { Anim } from '../types';

/**
 * Q 版角色（頭身比約 1:2.5，程式化幾何建模）
 * 動畫採「程序化骨架」：每個關節群組依目前動作計算目標姿勢，再以指數阻尼平滑插值，
 * 因此任兩個動作之間都能自然過渡，不需預先製作過渡動畫。
 * 角色預設面向 +Z；角色的左手在 +X。
 */
export interface PoseInput {
  anim: Anim;
  eyesClosed: boolean;
  /** 最近一次敲木魚的時間（performance.now） */
  strikeAt: number;
  /** 0..1 移動速度比例，影響走路擺幅 */
  speed: number;
  /** 坐著時下半身維持坐姿（上半身可同時合掌、禱告、敲木魚） */
  seated?: 'sit' | 'meditate' | null;
}

const HIP_Y = 0.36;

/* 共用幾何（所有角色共享，降低記憶體） */
const G = {
  head: new THREE.SphereGeometry(0.27, 28, 20),
  hairCap: new THREE.SphereGeometry(0.285, 28, 16, 0, Math.PI * 2, 0, 1.75),
  ear: new THREE.SphereGeometry(0.055, 10, 8),
  eye: new THREE.SphereGeometry(0.034, 12, 10),
  eyeHi: new THREE.SphereGeometry(0.011, 6, 6),
  closedEye: new THREE.TorusGeometry(0.03, 0.009, 6, 12, Math.PI),
  blush: new THREE.CircleGeometry(0.04, 16),
  smile: new THREE.TorusGeometry(0.035, 0.009, 6, 12, Math.PI),
  joyMouth: new THREE.CircleGeometry(0.04, 16, Math.PI, Math.PI),
  calmMouth: new THREE.CapsuleGeometry(0.008, 0.035, 4, 6),
  arm: new THREE.CapsuleGeometry(0.055, 0.17, 6, 10),
  wideSleeve: new THREE.CylinderGeometry(0.06, 0.095, 0.2, 12),
  hand: new THREE.SphereGeometry(0.058, 12, 10),
  leg: new THREE.CapsuleGeometry(0.062, 0.16, 6, 10),
  foot: new THREE.SphereGeometry(0.07, 12, 10),
  shirt: new THREE.CylinderGeometry(0.15, 0.19, 0.42, 20),
  shoulder: new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  robe: new THREE.LatheGeometry(
    [
      [0, -0.26],
      [0.25, -0.26],
      [0.24, -0.1],
      [0.2, 0.12],
      [0.165, 0.36],
      [0.12, 0.43],
      [0, 0.44],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    24,
  ),
  skirt: new THREE.CylinderGeometry(0.17, 0.28, 0.32, 20),
  rib: new THREE.TorusGeometry(0.185, 0.018, 6, 20),
  collar: new THREE.ConeGeometry(0.07, 0.1, 3),
  lapel: new THREE.BoxGeometry(0.06, 0.24, 0.02),
  vneck: new THREE.CircleGeometry(0.09, 3),
  button: new THREE.SphereGeometry(0.014, 6, 6),
  sash: new THREE.BoxGeometry(0.11, 0.62, 0.03),
  bead: new THREE.SphereGeometry(0.022, 8, 6),
  bun: new THREE.SphereGeometry(0.11, 14, 10),
  curl: new THREE.SphereGeometry(0.1, 10, 8),
  hairBack: new THREE.CapsuleGeometry(0.17, 0.22, 6, 12),
  hairSide: new THREE.CapsuleGeometry(0.09, 0.16, 6, 10),
  malletStick: new THREE.CylinderGeometry(0.013, 0.013, 0.32, 6),
  malletHead: new THREE.SphereGeometry(0.045, 10, 8),
};

function useMat(color: string, rough = 0.8) {
  return useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: rough }), [color, rough]);
}

interface Joints {
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

type Target = {
  bodyY: number;
  torsoX: number;
  headX: number;
  headY: number;
  aLx: number;
  aLz: number;
  aRx: number;
  aRz: number;
  lLx: number;
  lLz: number;
  lRx: number;
  lRz: number;
};

const T: Target = { bodyY: HIP_Y, torsoX: 0, headX: 0, headY: 0, aLx: 0, aLz: 0, aRx: 0, aRz: 0, lLx: 0, lLz: 0, lRx: 0, lRz: 0 };

/** 依動作計算目標姿勢 */
function computeTarget(p: PoseInput, t: number, walkPhase: number, now: number): Target {
  const o: Target = { ...T, aLz: 0.12, aRz: -0.12 };
  o.headY = Math.sin(t * 0.5) * 0.06;
  const hands = (x: number) => {
    o.aLx = x;
    o.aRx = x;
    o.aLz = -0.52;
    o.aRz = 0.52;
  };
  switch (p.anim) {
    case 'walk': {
      const s = Math.sin(walkPhase);
      const amp = 0.25 + 0.4 * p.speed;
      o.lLx = s * amp * 1.3;
      o.lRx = -s * amp * 1.3;
      o.aLx = -s * amp;
      o.aRx = s * amp;
      o.bodyY = HIP_Y + Math.abs(Math.cos(walkPhase)) * 0.035;
      o.torsoX = 0.05;
      o.headY = 0;
      break;
    }
    case 'sit':
      o.lLx = o.lRx = -1.45;
      o.aLx = o.aRx = -0.55;
      o.aLz = -0.15;
      o.aRz = 0.15;
      break;
    case 'meditate':
      o.lLx = o.lRx = -1.5;
      o.lLz = -0.55;
      o.lRz = 0.55;
      o.aLx = o.aRx = -0.75;
      o.aLz = -0.35;
      o.aRz = 0.35;
      o.headX = 0.1;
      o.headY = 0;
      break;
    case 'handsTogether':
      hands(-1.25);
      o.headX = 0.08;
      break;
    case 'pray':
      hands(-0.95);
      o.headX = 0.32;
      o.headY = 0;
      break;
    case 'bow': {
      hands(-1.2);
      o.torsoX = 0.55;
      o.headX = 0.2;
      o.headY = 0;
      break;
    }
    case 'wave':
      o.aRz = -2.55 + Math.sin(t * 9) * 0.3;
      o.aRx = -0.2;
      o.headY = -0.15;
      break;
    case 'happy':
      o.aLz = 2.5 + Math.sin(t * 10) * 0.15;
      o.aRz = -2.5 - Math.sin(t * 10) * 0.15;
      o.bodyY = HIP_Y + Math.abs(Math.sin(t * 6)) * 0.12;
      break;
    case 'fishDrum': {
      // 左手單掌立於胸前，右手持木槌敲擊
      o.aLx = -1.3;
      o.aLz = -0.45;
      const s = (now - p.strikeAt) / 1000;
      const e = Math.min(1, Math.max(0, s / 0.35));
      o.aRx = -0.7 - 0.55 * (1 - Math.pow(1 - e, 2));
      o.aRz = 0.28;
      o.headX = 0.18;
      o.headY = 0;
      break;
    }
    default:
      break;
  }
  if (p.anim !== 'walk' && p.seated === 'sit' && p.anim !== 'sit') {
    o.lLx = o.lRx = -1.45;
    o.lLz = o.lRz = 0;
    o.torsoX = Math.min(o.torsoX, 0.3);
  } else if (p.anim !== 'walk' && p.seated === 'meditate' && p.anim !== 'meditate') {
    o.lLx = o.lRx = -1.5;
    o.lLz = -0.55;
    o.lRz = 0.55;
    o.torsoX = Math.min(o.torsoX, 0.3);
  }
  return o;
}

export function Chibi({
  avatar,
  pose,
}: {
  avatar: AvatarConfig;
  pose: MutableRefObject<PoseInput>;
}) {
  const j = useRef<Partial<Joints>>({});
  const eyesOpen = useRef<THREE.Group>(null);
  const eyesShut = useRef<THREE.Group>(null);
  const mallet = useRef<THREE.Group>(null);
  const walkPhase = useRef(0);
  const blinkAt = useRef(2 + Math.random() * 3);

  const skin = useMat(avatar.skin, 0.7);
  const primary = useMat(avatar.primary);
  const secondary = useMat(avatar.secondary);
  const hairMat = useMat(avatar.wardrobe === 'monk' ? shade(avatar.skin, 0.82) : avatar.hairColor, 0.9);
  const dark = useMat('#2d2622', 0.4);
  const white = useMat('#fbf8f2', 0.7);
  const blush = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f4a3a0', transparent: true, opacity: 0.55 }), []);
  const shoe = useMat(avatar.wardrobe === 'monk' ? '#6b6157' : '#4b3a30', 0.6);
  const wood = useMat('#8a5a35', 0.7);
  const bead = useMat('#5b3a26', 0.5);

  const monk = avatar.wardrobe === 'monk';
  const closedByStyle = avatar.expression === 'calm';

  useFrame(({ clock }, dt) => {
    const J = j.current as Joints;
    if (!J.body) return;
    const t = clock.getElapsedTime();
    const p = pose.current;
    if (p.anim === 'walk') walkPhase.current += dt * (6 + p.speed * 5);
    const tgt = computeTarget(p, t, walkPhase.current, performance.now());
    const k = 1 - Math.exp(-dt * (p.anim === 'walk' ? 16 : 8));
    const L = THREE.MathUtils.lerp;
    J.body.position.y = L(J.body.position.y, tgt.bodyY, k);
    J.torso.rotation.x = L(J.torso.rotation.x, tgt.torsoX, k);
    J.head.rotation.x = L(J.head.rotation.x, tgt.headX, k);
    J.head.rotation.y = L(J.head.rotation.y, tgt.headY, k);
    J.armL.rotation.x = L(J.armL.rotation.x, tgt.aLx, k);
    J.armL.rotation.z = L(J.armL.rotation.z, tgt.aLz, k);
    J.armR.rotation.x = L(J.armR.rotation.x, tgt.aRx, k);
    J.armR.rotation.z = L(J.armR.rotation.z, tgt.aRz, k);
    J.legL.rotation.x = L(J.legL.rotation.x, tgt.lLx, k);
    J.legL.rotation.z = L(J.legL.rotation.z, tgt.lLz, k);
    J.legR.rotation.x = L(J.legR.rotation.x, tgt.lRx, k);
    J.legR.rotation.z = L(J.legR.rotation.z, tgt.lRz, k);

    // 呼吸：靜坐時較深、較慢
    const deep = p.anim === 'meditate' || p.anim === 'pray';
    const breath = Math.sin(t * (deep ? 1.1 : 1.8));
    J.torso.scale.set(1 + breath * (deep ? 0.02 : 0.008), 1 + breath * (deep ? 0.03 : 0.012), 1 + breath * (deep ? 0.02 : 0.008));

    // 眼睛：閉眼（靜坐、默禱或「平靜」表情）或眨眼
    const closed = p.eyesClosed || closedByStyle;
    if (eyesOpen.current && eyesShut.current) {
      eyesShut.current.visible = closed;
      eyesOpen.current.visible = !closed;
      if (!closed) {
        if (t > blinkAt.current) blinkAt.current = t + 2.5 + Math.random() * 4;
        const blinking = blinkAt.current - t > 2.35 && blinkAt.current - t < 2.5;
        eyesOpen.current.scale.y = blinking ? 0.1 : 1;
      }
    }
    if (mallet.current) mallet.current.visible = p.anim === 'fishDrum';
  });

  const ref = (name: keyof Joints) => (g: THREE.Group | null) => {
    if (g) j.current[name] = g;
  };

  const sleeve = monk ? G.wideSleeve : G.arm;
  const legMat = monk ? primary : avatar.outfit === 'dress' ? skin : secondary;
  const torsoMat = primary;

  return (
    <group>
      {/* 接地陰影 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.3, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <group ref={ref('body')} position={[0, HIP_Y, 0]}>
        {/* 腿 */}
        {([
          ['legL', 0.085],
          ['legR', -0.085],
        ] as const).map(([name, x]) => (
          <group key={name} ref={ref(name)} position={[x, 0, 0]}>
            <M g={G.leg} m={legMat} position={[0, -0.16, 0]} />
            <M g={G.foot} m={shoe} position={[0, -0.31, 0.035]} scale={[0.9, 0.6, 1.25]} />
          </group>
        ))}

        <group ref={ref('torso')}>
          {/* 身體／服裝 */}
          {monk ? (
            <>
              <M g={G.robe} m={primary} />
              {/* 交領 */}
              <M g={G.vneck} m={white} position={[0, 0.34, 0.165]} rotation={[-0.25, 0, Math.PI]} scale={[0.8, 1, 1]} />
              {avatar.monkStyle === 'sash' && <M g={G.sash} m={secondary} position={[0.02, 0.1, 0.02]} rotation={[0, 0, 0.55]} scale={[1, 1, 7.6]} />}
              {avatar.monkStyle === 'beads' &&
                Array.from({ length: 16 }, (_, i) => {
                  const a = (i / 16) * Math.PI * 2;
                  return <M key={i} g={G.bead} m={bead} position={[Math.sin(a) * 0.15, 0.37 - (Math.cos(a) * 0.5 + 0.5) * 0.12, Math.cos(a) * 0.12 + 0.03]} />;
                })}
            </>
          ) : (
            <>
              <M g={G.shirt} m={torsoMat} position={[0, 0.17, 0]} />
              <M g={G.shoulder} m={torsoMat} position={[0, 0.38, 0]} scale={[1, 0.35, 1]} />
              {avatar.outfit === 'dress' && <M g={G.skirt} m={secondary} position={[0, -0.04, 0]} />}
              {avatar.outfit === 'shirt' && (
                <>
                  <M g={G.collar} m={white} position={[0.05, 0.37, 0.13]} rotation={[0.3, 0, Math.PI]} />
                  <M g={G.collar} m={white} position={[-0.05, 0.37, 0.13]} rotation={[0.3, 0, Math.PI]} />
                  {[0.28, 0.18, 0.08].map((y) => (
                    <M key={y} g={G.button} m={white} position={[0, y, 0.165 + (0.3 - y) * 0.05]} />
                  ))}
                </>
              )}
              {avatar.outfit === 'blazer' && (
                <>
                  <M g={G.vneck} m={white} position={[0, 0.3, 0.158]} rotation={[-0.15, 0, Math.PI]} scale={[0.9, 1.4, 1]} />
                  <M g={G.lapel} m={secondary} position={[0.065, 0.24, 0.165]} rotation={[-0.12, 0, 0.35]} />
                  <M g={G.lapel} m={secondary} position={[-0.065, 0.24, 0.165]} rotation={[-0.12, 0, -0.35]} />
                  <M g={G.button} m={dark} position={[0, 0.1, 0.18]} />
                </>
              )}
              {avatar.outfit === 'knit' && (
                <>
                  <M g={G.rib} m={secondary} position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]} />
                  <M g={G.rib} m={secondary} position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]} scale={0.6} />
                </>
              )}
            </>
          )}

          {/* 手臂 */}
          {([
            ['armL', 0.19],
            ['armR', -0.19],
          ] as const).map(([name, x]) => (
            <group key={name} ref={ref(name)} position={[x, 0.36, 0]}>
              <M g={sleeve} m={primary} position={[0, -0.13, 0]} />
              <M g={G.hand} m={skin} position={[0, -0.27, 0]} />
              {name === 'armR' && (
                <group ref={mallet} position={[0, -0.28, 0.02]} rotation={[1.4, 0, 0]} visible={false}>
                  <M g={G.malletStick} m={wood} position={[0, 0.13, 0]} />
                  <M g={G.malletHead} m={wood} position={[0, 0.3, 0]} />
                </group>
              )}
            </group>
          ))}

          {/* 頭部 */}
          <group ref={ref('head')} position={[0, 0.42, 0]}>
            <M g={G.head} m={skin} position={[0, 0.25, 0]} />
            <M g={G.ear} m={skin} position={[0.265, 0.22, 0]} />
            <M g={G.ear} m={skin} position={[-0.265, 0.22, 0]} />
            {/* 髮型 */}
            {monk ? (
              <mesh geometry={G.hairCap} material={hairMat} position={[0, 0.255, -0.01]} rotation={[-0.45, 0, 0]} scale={[0.97, 0.97, 0.97]} />
            ) : (
              <Hair kind={avatar.hair} mat={hairMat} />
            )}
            {/* 臉 */}
            <group position={[0, 0.22, 0.255]}>
              <group ref={eyesOpen}>
                {[0.095, -0.095].map((x) => (
                  <group key={x} position={[x, 0.03, 0]}>
                    <mesh geometry={G.eye} material={dark} scale={[1, 1.3, 0.6]} />
                    <mesh geometry={G.eyeHi} material={white} position={[0.01, 0.017, 0.02]} />
                  </group>
                ))}
              </group>
              <group ref={eyesShut} visible={false}>
                {[0.095, -0.095].map((x) => (
                  <mesh key={x} geometry={G.closedEye} material={dark} position={[x, 0.02, 0.005]} rotation={[0, 0, Math.PI]} />
                ))}
              </group>
              {[0.16, -0.16].map((x) => (
                <mesh key={x} geometry={G.blush} material={blush} position={[x, -0.035, -0.035]} rotation={[0, x > 0 ? 0.55 : -0.55, 0]} />
              ))}
              {avatar.expression === 'joy' ? (
                <mesh geometry={G.joyMouth} material={dark} position={[0, -0.045, 0.012]} scale={[0.9, 0.8, 1]} />
              ) : avatar.expression === 'calm' ? (
                <mesh geometry={G.calmMouth} material={dark} position={[0, -0.05, 0.012]} rotation={[0, 0, Math.PI / 2]} />
              ) : (
                <mesh geometry={G.smile} material={dark} position={[0, -0.03, 0.012]} rotation={[0, 0, Math.PI]} />
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function M({ g, m, ...rest }: { g: THREE.BufferGeometry; m: THREE.Material } & JSX.IntrinsicElements['mesh']) {
  return <mesh geometry={g} material={m} castShadow {...rest} />;
}

function Hair({ kind, mat }: { kind: AvatarConfig['hair']; mat: THREE.Material }) {
  const cap = <mesh geometry={G.hairCap} material={mat} position={[0, 0.265, -0.015]} rotation={[-0.5, 0, 0]} castShadow />;
  switch (kind) {
    case 'bob':
      return (
        <>
          {cap}
          <mesh geometry={G.hairSide} material={mat} position={[0.2, 0.14, -0.02]} castShadow />
          <mesh geometry={G.hairSide} material={mat} position={[-0.2, 0.14, -0.02]} castShadow />
          <mesh geometry={G.hairBack} material={mat} position={[0, 0.16, -0.1]} scale={[1.2, 0.8, 0.8]} castShadow />
        </>
      );
    case 'long':
      return (
        <>
          {cap}
          <mesh geometry={G.hairBack} material={mat} position={[0, 0.05, -0.12]} scale={[1.25, 1.2, 0.8]} castShadow />
        </>
      );
    case 'bun':
      return (
        <>
          {cap}
          <mesh geometry={G.bun} material={mat} position={[0, 0.52, -0.1]} castShadow />
        </>
      );
    case 'curly':
      return (
        <>
          {cap}
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2;
            return <mesh key={i} geometry={G.curl} material={mat} position={[Math.sin(a) * 0.2, 0.38 + Math.cos(a * 2) * 0.03, Math.cos(a) * 0.2 - 0.06]} castShadow />;
          })}
        </>
      );
    default:
      return cap;
  }
}

function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
}
