import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { AvatarConfig } from '../data/avatar';
import { audio } from '../audio/engine';
import { Chibi, type PoseInput } from './character/Chibi';
import { Bubble } from './RemotePlayers';
import { heightAt, resolveCollisions } from './physics';
import type { SceneLayout } from './types';
import { input, player, standUp, worldStore } from './worldStore';

const WALK_SPEED = 3.1;
const CAM_HEIGHT = 1.0;
const tmpF = new THREE.Vector3();
const tmpR = new THREE.Vector3();
const tmpMove = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

function angleLerp(a: number, b: number, k: number) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/**
 * 本機玩家：即時移動（不等待任何網路請求），處理鍵盤／搖桿／點擊移動、碰撞、座位、
 * 鄰近互動物件判定，以及鏡頭跟隨。
 */
export function Player({ layout, avatar, nickname }: { layout: SceneLayout; avatar: AvatarConfig; nickname: string }) {
  const group = useRef<THREE.Group>(null);
  const pose = useRef<PoseInput>({ anim: 'idle', eyesClosed: false, strikeAt: 0, speed: 0, seated: null });
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const portrait = useThree((s) => s.size.width < s.size.height);
  const lastCheck = useRef(0);
  const prevTarget = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const { x, z, rot } = layout.spawn;
    player.pos.set(x, heightAt(layout.floors, x, z), z);
    player.rot = rot;
    player.face = null;
    const dist = portrait ? 13 : 9;
    camera.position.set(x - Math.sin(rot) * dist, portrait ? 8.5 : 6.2, z - Math.cos(rot) * dist);
    prevTarget.set(x, CAM_HEIGHT, z);
    if (controls) {
      controls.target.copy(prevTarget);
      controls.update();
    }
  }, [layout, camera, controls, prevTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = worldStore.get();
    const now = performance.now();

    // ---- 輸入方向（以鏡頭方向為基準） ----
    camera.getWorldDirection(tmpF);
    tmpF.y = 0;
    tmpF.normalize();
    tmpR.crossVectors(tmpF, up).normalize();
    const ix = THREE.MathUtils.clamp(input.x + input.joyX, -1, 1);
    const iz = THREE.MathUtils.clamp(input.z + input.joyZ, -1, 1);
    tmpMove.set(0, 0, 0).addScaledVector(tmpF, iz).addScaledVector(tmpR, ix);
    let mag = Math.min(1, tmpMove.length());
    if (mag > 0.08 && s.moveTarget) worldStore.set({ moveTarget: null });
    if (mag <= 0.08 && s.moveTarget) {
      const dx = s.moveTarget[0] - player.pos.x;
      const dz = s.moveTarget[1] - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) {
        worldStore.set({ moveTarget: null });
      } else {
        tmpMove.set(dx, 0, dz);
        mag = Math.min(1, d / 0.6);
      }
    }

    const moving = mag > 0.08;
    if (moving) {
      if (s.seat || s.baseAnim !== 'idle' || s.fishAuto || s.meditation) standUp();
      if (s.gesture) worldStore.set({ gesture: null });
      player.face = null;
      tmpMove.normalize();
      const step = WALK_SPEED * mag * dt;
      const p = { x: player.pos.x + tmpMove.x * step, z: player.pos.z + tmpMove.z * step };
      const before = { x: player.pos.x, z: player.pos.z };
      resolveCollisions(layout, p);
      // 點擊移動時撞到障礙物就停下，避免原地抖動
      if (s.moveTarget && Math.hypot(p.x - before.x, p.z - before.z) < step * 0.15) worldStore.set({ moveTarget: null });
      player.pos.x = p.x;
      player.pos.z = p.z;
      player.rot = angleLerp(player.rot, Math.atan2(tmpMove.x, tmpMove.z), 1 - Math.exp(-dt * 12));
      const gy = heightAt(layout.floors, p.x, p.z);
      player.pos.y += (gy - player.pos.y) * (1 - Math.exp(-dt * 14));
    } else if (s.seat) {
      const k = 1 - Math.exp(-dt * 6);
      player.pos.x += (s.seat.x - player.pos.x) * k;
      player.pos.z += (s.seat.z - player.pos.z) * k;
      player.pos.y += (s.seat.y - player.pos.y) * k;
      player.rot = angleLerp(player.rot, s.seat.rot, k);
    } else {
      const gy = heightAt(layout.floors, player.pos.x, player.pos.z);
      player.pos.y += (gy - player.pos.y) * (1 - Math.exp(-dt * 14));
      if (player.face) {
        player.rot = angleLerp(player.rot, Math.atan2(player.face[0] - player.pos.x, player.face[1] - player.pos.z), 1 - Math.exp(-dt * 6));
      }
    }
    player.moving = moving;
    player.speed = moving ? mag : 0;

    // ---- 動作狀態 ----
    let anim = s.baseAnim;
    if (s.gesture) {
      if (now < s.gesture.until) anim = s.gesture.anim;
      else worldStore.set({ gesture: null });
    }
    if (moving) anim = 'walk';
    pose.current.anim = anim;
    pose.current.eyesClosed = s.eyesClosed && !moving;
    pose.current.strikeAt = s.lastStrike;
    pose.current.speed = player.speed;
    pose.current.seated = moving ? null : s.seat?.pose ?? null;

    if (group.current) {
      group.current.position.copy(player.pos);
      group.current.rotation.y = player.rot;
    }

    // ---- 鏡頭跟隨：平移鏡頭以保持使用者設定的角度與距離 ----
    if (controls) {
      const tgt = tmpF.set(player.pos.x, player.pos.y + CAM_HEIGHT, player.pos.z);
      const k = 1 - Math.exp(-dt * 8);
      const nx = prevTarget.x + (tgt.x - prevTarget.x) * k;
      const ny = prevTarget.y + (tgt.y - prevTarget.y) * k;
      const nz = prevTarget.z + (tgt.z - prevTarget.z) * k;
      camera.position.x += nx - prevTarget.x;
      camera.position.y += ny - prevTarget.y;
      camera.position.z += nz - prevTarget.z;
      prevTarget.set(nx, ny, nz);
      controls.target.copy(prevTarget);
      if (input.cam) {
        const a = input.cam * dt * 1.8;
        const ox = camera.position.x - nx;
        const oz = camera.position.z - nz;
        camera.position.x = nx + ox * Math.cos(a) - oz * Math.sin(a);
        camera.position.z = nz + ox * Math.sin(a) + oz * Math.cos(a);
      }
      controls.update();
    }

    // ---- 鄰近互動、室內判定、水聲遠近（節流） ----
    if (now - lastCheck.current > 150) {
      lastCheck.current = now;
      let best = null as (typeof layout.interactables)[number] | null;
      let bestD = Infinity;
      for (const it of layout.interactables) {
        const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z);
        if (d < it.r && d < bestD) {
          best = it;
          bestD = d;
        }
      }
      // 坐著時保留目前座位的互動面板
      if (s.seat) best = layout.interactables.find((i) => i.id === s.seat!.id) ?? best;
      if (best?.id !== s.nearby?.id) worldStore.set({ nearby: best });
      const r = layout.interior;
      const inside = Math.abs(player.pos.x - r.x) < r.hw && Math.abs(player.pos.z - r.z) < r.hd;
      if (inside !== s.inside) worldStore.set({ inside });
      let water = 0;
      for (const w of layout.waterSources) {
        const d = Math.hypot(w.x - player.pos.x, w.z - player.pos.z);
        water = Math.max(water, w.loud * THREE.MathUtils.clamp(1 - d / 22, 0, 1));
      }
      audio.setWater(water);
    }
  });

  return (
    <group ref={group}>
      <Chibi avatar={avatar} pose={pose} />
      <Html position={[0, 1.62, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
        <div className="nameplate flex flex-col items-center">
          <Bubble playerId="self" />
          <div className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-bold text-forest shadow">{nickname}</div>
        </div>
      </Html>
    </group>
  );
}

/** 點擊地面移動的目標標記 */
export function MoveMarker({ layout }: { layout: SceneLayout }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = worldStore.get().moveTarget;
    m.visible = !!t;
    if (t) {
      m.position.set(t[0], heightAt(layout.floors, t[0], t[1]) + 0.05, t[1]);
      const s = 1 + Math.sin(clock.getElapsedTime() * 6) * 0.12;
      m.scale.set(s, s, s);
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.22, 0.32, 24]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
}
