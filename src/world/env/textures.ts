import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

/** 以 Canvas 產生文字貼圖（匾額、看板），使用網頁字型，不需額外字型檔 */
export function textTexture(text: string, opts: { bg: string; fg: string; w?: number; h?: number; font?: number; border?: string; vertical?: boolean }) {
  const key = JSON.stringify([text, opts]);
  const hit = cache.get(key);
  if (hit) return hit;
  const w = opts.w ?? 512;
  const h = opts.h ?? 160;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = opts.bg;
  g.fillRect(0, 0, w, h);
  if (opts.border) {
    g.strokeStyle = opts.border;
    g.lineWidth = 12;
    g.strokeRect(8, 8, w - 16, h - 16);
  }
  g.fillStyle = opts.fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${opts.font ?? 84}px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;
  const lines = text.split('\n');
  const lh = (opts.font ?? 84) * 1.35;
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** 木格窗貼圖 */
export function latticeTexture(bg: string, line: string) {
  const key = `lattice-${bg}-${line}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = line;
  g.lineWidth = 7;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 128);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(128, i);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}

/** 彩繪玻璃貼圖（原創幾何圖樣） */
export function stainedGlassTexture(seed: number) {
  const key = `glass-${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  const cols = ['#e9b44c', '#7fb0d9', '#b88fcf', '#9fd0a6', '#f2a6a0', '#f6e3a1'];
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 128; x += 32) {
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      g.fillRect(x, y, 32, 32);
    }
  }
  g.fillStyle = '#fff6d8';
  g.beginPath();
  g.arc(64, 90, 30, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#3c3a40';
  g.lineWidth = 4;
  for (let y = 0; y <= 256; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(128, y);
    g.stroke();
  }
  for (let x = 0; x <= 128; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  g.beginPath();
  g.arc(64, 90, 30, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
