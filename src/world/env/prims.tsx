import { useMemo } from 'react';
import * as THREE from 'three';

/** 低多邊形共用幾何元件（沿用 OSCE Island primitives 的設計，改為療癒系配色與柔和材質） */
export type V3 = [number, number, number];

interface MatProps {
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  flat?: boolean;
}

interface Placement {
  position?: V3;
  rotation?: V3;
  scale?: number | V3;
  shadow?: boolean;
}

export function Mat({ color, emissive, emissiveIntensity = 0, opacity, roughness = 0.85, metalness = 0, flat = true }: MatProps) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={emissiveIntensity}
      flatShading={flat}
      roughness={roughness}
      metalness={metalness}
      transparent={opacity !== undefined}
      opacity={opacity ?? 1}
    />
  );
}

export function Box({ size = [1, 1, 1], shadow = true, ...p }: Placement & MatProps & { size?: V3 }) {
  return (
    <mesh position={p.position} rotation={p.rotation} scale={p.scale} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      <Mat {...p} />
    </mesh>
  );
}

export function Cyl({ args = [0.5, 0.5, 1, 10], shadow = true, ...p }: Placement & MatProps & { args?: [number, number, number, number] }) {
  return (
    <mesh position={p.position} rotation={p.rotation} scale={p.scale} castShadow={shadow} receiveShadow>
      <cylinderGeometry args={args} />
      <Mat {...p} />
    </mesh>
  );
}

export function Cone({ r = 0.5, h = 1, seg = 6, shadow = true, ...p }: Placement & MatProps & { r?: number; h?: number; seg?: number }) {
  return (
    <mesh position={p.position} rotation={p.rotation} scale={p.scale} castShadow={shadow} receiveShadow>
      <coneGeometry args={[r, h, seg]} />
      <Mat {...p} />
    </mesh>
  );
}

export function Ball({ r = 0.5, detail = 1, shadow = true, ...p }: Placement & MatProps & { r?: number; detail?: number }) {
  return (
    <mesh position={p.position} rotation={p.rotation} scale={p.scale} castShadow={shadow} receiveShadow>
      <icosahedronGeometry args={[r, detail]} />
      <Mat {...p} />
    </mesh>
  );
}

export function Sphere({ r = 0.5, shadow = true, ...p }: Placement & MatProps & { r?: number }) {
  return (
    <mesh position={p.position} rotation={p.rotation} scale={p.scale} castShadow={shadow} receiveShadow>
      <sphereGeometry args={[r, 20, 14]} />
      <Mat flat={false} {...p} />
    </mesh>
  );
}

/** 四坡屋頂（廡殿頂）：以四角錐縮放成矩形，底面位於 position.y */
export function HipRoof({ width, depth, height, position, color, flare = 1 }: { width: number; depth: number; height: number; position: V3; color: string; flare?: number }) {
  return (
    <mesh position={[position[0], position[1] + height / 2, position[2]]} rotation={[0, Math.PI / 4, 0]} scale={[width / Math.SQRT2, 1, depth / Math.SQRT2]} castShadow receiveShadow>
      <coneGeometry args={[1 * flare, height, 4, 1]} />
      <Mat color={color} />
    </mesh>
  );
}

/** 人字形屋頂 */
export function GableRoof({ width, depth, height, position, color, rotation }: { width: number; depth: number; height: number; position: V3; color: string; rotation?: V3 }) {
  const geometry = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0);
    s.lineTo(width / 2, 0);
    s.lineTo(0, height);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    return g;
  }, [width, depth, height]);
  return (
    <mesh geometry={geometry} position={position} rotation={rotation} castShadow receiveShadow>
      <Mat color={color} />
    </mesh>
  );
}

export function Bench({ position, rotation, color = '#b98a5e' }: { position: V3; rotation?: V3; color?: string }) {
  return (
    <group position={position} rotation={rotation}>
      <Box size={[1.7, 0.08, 0.45]} position={[0, 0.43, 0]} color={color} />
      <Box size={[1.7, 0.36, 0.07]} position={[0, 0.66, 0.24]} rotation={[-0.12, 0, 0]} color={color} />
      {[-0.7, 0.7].map((x) => (
        <Box key={x} size={[0.08, 0.42, 0.4]} position={[x, 0.2, 0]} color="#7a5a3e" />
      ))}
    </group>
  );
}

/** 程式產生的柔和光暈貼圖（霧氣、光暈、螢火蟲共用） */
let glowTex: THREE.CanvasTexture | null = null;
export function getGlowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** 柔光（例如燈籠夜間光暈） */
export function Glow({ position, color, size = 1, opacity = 0.6 }: { position: V3; color: string; size?: number; opacity?: number }) {
  return (
    <sprite position={position} scale={[size, size, size]}>
      <spriteMaterial map={getGlowTexture()} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}
