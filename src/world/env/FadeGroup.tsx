import { useEffect, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { worldStore } from '../worldStore';

/** 玩家進入室內時淡出屋頂，方便從上方視角看見室內 */
export function FadeGroup({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const mats = useRef<THREE.Material[]>([]);
  const op = useRef(1);
  useEffect(() => {
    const list: THREE.Material[] = [];
    ref.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && !list.includes(m)) {
        m.transparent = true;
        list.push(m);
      }
    });
    mats.current = list;
  });
  useFrame((_, dt) => {
    const target = worldStore.get().inside ? 0 : 1;
    op.current += (target - op.current) * (1 - Math.exp(-dt * 6));
    const g = ref.current;
    if (!g) return;
    g.visible = op.current > 0.03;
    for (const m of mats.current) {
      m.opacity = op.current;
      m.depthWrite = op.current > 0.95;
    }
  });
  return <group ref={ref}>{children}</group>;
}
