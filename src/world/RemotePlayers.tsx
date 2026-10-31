import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { netStore, remotes, useNet } from '../net/netStore';
import { Chibi, type PoseInput } from './character/Chibi';
import { player } from './worldStore';

function angleLerp(a: number, b: number, k: number) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

export function Bubble({ playerId }: { playerId: string }) {
  const b = useNet((s) => s.bubbles.find((x) => x.playerId === playerId));
  if (!b || b.until < Date.now()) return null;
  return (
    <div key={b.id} className="mb-1 animate-fade-up whitespace-nowrap rounded-2xl bg-white px-3 py-1 text-sm font-bold text-stone-700 shadow-soft">
      {b.text}
    </div>
  );
}

/**
 * 其他玩家：在兩次同步之間以固定速度插值到最新位置；
 * 資料逾期時不再推測行走，直接停在最後已知位置。
 */
function RemoteAvatar({ id }: { id: string }) {
  const r = remotes.get(id);
  const group = useRef<THREE.Group>(null);
  const label = useRef<THREE.Group>(null);
  const pose = useRef<PoseInput>({ anim: 'idle', eyesClosed: false, strikeAt: 0, speed: 0.5, seated: null });
  const focus = useNet((s) => s.focusMode);

  useFrame((_, rawDt) => {
    const p = remotes.get(id);
    if (!p || !group.current) return;
    const dt = Math.min(rawDt, 0.1);
    const now = performance.now();
    const interval = netStore.get().interval;
    const stale = now - p.receivedAt > interval * 2 + 10_000;
    const d = p.pos.distanceTo(p.target);
    let walking = false;
    if (d > 15 || stale) {
      p.pos.copy(p.target);
    } else if (d > 0.03) {
      const step = Math.min(d, p.speed * dt);
      const dx = p.target.x - p.pos.x;
      const dz = p.target.z - p.pos.z;
      p.pos.lerp(p.target, step / d);
      walking = Math.hypot(dx, dz) > 0.15;
      if (walking) p.rot = angleLerp(p.rot, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
    }
    if (!walking) p.rot = angleLerp(p.rot, p.targetRot, 1 - Math.exp(-dt * 5));
    group.current.position.copy(p.pos);
    group.current.rotation.y = p.rot;

    let anim = p.anim === 'walk' && !walking ? 'idle' : p.anim;
    if (walking) anim = 'walk';
    if (p.gesture && now < p.gesture.until && !walking) anim = p.gesture.anim;
    pose.current.anim = anim;
    pose.current.eyesClosed = p.eyesClosed && !walking;
    pose.current.seated = walking ? null : p.seated === 'm' ? 'meditate' : p.seated === 's' ? 'sit' : null;
    pose.current.speed = walking ? 0.6 : 0;
    if (anim === 'fishDrum') pose.current.strikeAt = Math.floor(now / 1000) * 1000;

    // 名牌避免重疊：附近（0.9 公尺內）每多一位 ID 較小的角色，名牌就往上錯開一格
    if (label.current) {
      let rank = 0;
      for (const o of remotes.values()) if (o.id < id && o.pos.distanceTo(p.pos) < 0.9) rank++;
      if (player.pos.distanceTo(p.pos) < 0.9) rank++;
      label.current.position.y = 1.62 + rank * 0.3;
    }
  });

  if (!r) return null;
  return (
    <group ref={group} position={r.pos.toArray()}>
      <Chibi avatar={r.avatar} pose={pose} />
      <group ref={label} position={[0, 1.62, 0]}>
        <Html center zIndexRange={[19, 0]} pointerEvents="none">
          <div className="nameplate flex flex-col items-center">
            {!focus && <Bubble playerId={id} />}
            <div className="rounded-full bg-white/75 px-2 py-0.5 text-[11px] font-bold text-stone-600 shadow">{r.nickname}</div>
          </div>
        </Html>
      </group>
    </group>
  );
}

export function RemotePlayers() {
  const ids = useNet((s) => s.ids);
  return (
    <>
      {ids.map((id) => (
        <RemoteAvatar key={id} id={id} />
      ))}
    </>
  );
}
