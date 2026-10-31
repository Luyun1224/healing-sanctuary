import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useBlessings, type Blessing } from '../../net/blessings';
import { Box, Cyl } from '../env/prims';
import { textTexture } from '../env/textures';
import { worldStore } from '../worldStore';

/**
 * 功德箱（佛堂）／奉獻箱（教堂）＋祈福留言板。
 * 投入的是象徵祝福的虛擬錢幣，不涉及任何真實金錢；留言板顯示大家最新的祝福。
 */
const NOTE_COLORS = ['#fff6c8', '#ffe1e6', '#e3f1dc', '#e2ecf8'];

function wrap(g: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const lines: string[] = [];
  let cur = '';
  for (const ch of Array.from(text)) {
    if (g.measureText(cur + ch).width > width) {
      lines.push(cur);
      cur = ch;
      if (lines.length === maxLines) break;
    } else cur += ch;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && Array.from(lines.join('')).length < Array.from(text).length) lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
  return lines;
}

function boardTexture(title: string, list: Blessing[], tone: string) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 500;
  const g = c.getContext('2d')!;
  g.fillStyle = tone;
  g.fillRect(0, 0, 640, 500);
  const font = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
  g.fillStyle = '#4a3a2a';
  g.textAlign = 'center';
  g.font = `700 40px ${font}`;
  g.fillText(title, 320, 52);
  g.textAlign = 'left';
  const notes = list.slice(0, 4);
  if (!notes.length) {
    g.textAlign = 'center';
    g.font = `500 28px ${font}`;
    g.fillStyle = '#7a6a58';
    g.fillText('還沒有留言，', 320, 230);
    g.fillText('留下第一句祝福吧', 320, 272);
  }
  notes.forEach((n, i) => {
    const x = 28 + (i % 2) * 300;
    const y = 82 + Math.floor(i / 2) * 205;
    g.save();
    g.translate(x + 140, y + 95);
    g.rotate(((i % 3) - 1) * 0.025);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(-136, -86, 280, 186);
    g.fillStyle = NOTE_COLORS[i % NOTE_COLORS.length];
    g.fillRect(-140, -92, 280, 186);
    g.fillStyle = '#d9a944';
    g.beginPath();
    g.arc(0, -82, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3f3a33';
    g.font = `500 26px ${font}`;
    wrap(g, n.content, 244, 4).forEach((l, k) => g.fillText(l, -122, -42 + k * 34));
    g.fillStyle = '#7a6a58';
    g.font = `400 20px ${font}`;
    g.textAlign = 'right';
    g.fillText(`— ${n.nickname}`, 124, 80);
    g.textAlign = 'left';
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function Offering({ variant, position, rotationY }: { variant: 'temple' | 'church'; position: [number, number, number]; rotationY: number }) {
  const list = useBlessings((s) => s.list);
  const tex = useMemo(() => boardTexture(variant === 'temple' ? '祈福留言板' : '祝福留言牆', list, variant === 'temple' ? '#efe0c2' : '#f4efe6'), [list, variant]);
  useEffect(() => () => tex.dispose(), [tex]);
  const plaque = useMemo(() => textTexture(variant === 'temple' ? '隨喜祈福' : '愛心祝福', { bg: variant === 'temple' ? '#7b2e1e' : '#5c4a3a', fg: '#f2cf6b', w: 256, h: 96, font: 52 }), [variant]);
  const coin = useRef<THREE.Mesh>(null);
  const wood = variant === 'temple' ? '#8a4f30' : '#8a6446';

  // 錢幣從角色手上以拋物線落入投入口
  useFrame(() => {
    const m = coin.current;
    if (!m) return;
    const s = (performance.now() - worldStore.get().offeringAt) / 500;
    m.visible = s >= 0 && s < 1;
    if (!m.visible) return;
    m.position.set(0, 1.25 + Math.sin(s * Math.PI) * 0.35 - s * 0.6, 0.95 - s * 0.85);
    m.rotation.set(s * 9, 0, Math.PI / 2);
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 留言板 */}
      <group position={[0, 0, -0.32]}>
        {[-0.72, 0.72].map((x) => (
          <Box key={x} size={[0.09, 2.1, 0.09]} position={[x, 1.05, 0]} color={wood} />
        ))}
        <Box size={[1.56, 1.24, 0.06]} position={[0, 1.42, 0]} color={wood} />
        <mesh position={[0, 1.42, 0.035]}>
          <planeGeometry args={[1.44, 1.12]} />
          <meshStandardMaterial map={tex} roughness={0.9} />
        </mesh>
        <Box size={[1.7, 0.08, 0.14]} position={[0, 2.1, 0.02]} color={wood} />
      </group>
      {/* 功德箱／奉獻箱 */}
      <group position={[0, 0, 0.12]}>
        <Box size={[0.66, 0.6, 0.42]} position={[0, 0.3, 0]} color={variant === 'temple' ? '#a2552c' : '#9a6a42'} />
        <Box size={[0.7, 0.05, 0.46]} position={[0, 0.62, 0]} color="#d9a944" metalness={0.4} />
        <Box size={[0.26, 0.012, 0.04]} position={[0, 0.65, 0]} color="#2a1a10" shadow={false} />
        <mesh position={[0, 0.34, 0.212]}>
          <planeGeometry args={[0.44, 0.17]} />
          <meshStandardMaterial map={plaque} />
        </mesh>
        <Cyl args={[0.14, 0.16, 0.03, 16]} position={[-0.42, 0.015, 0.1]} color="#d9a944" metalness={0.4} shadow={false} />
      </group>
      <mesh ref={coin} visible={false}>
        <cylinderGeometry args={[0.045, 0.045, 0.012, 16]} />
        <meshStandardMaterial color="#f2c14e" metalness={0.7} roughness={0.25} emissive="#a87a1a" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
