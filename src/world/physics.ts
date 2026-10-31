import type { Collider, Floor, SceneLayout } from './types';

export const PLAYER_RADIUS = 0.32;

/** 依地面區塊計算 (x,z) 的地面高度；取所有覆蓋區塊中的最高值 */
export function heightAt(floors: Floor[], x: number, z: number): number {
  let h = 0;
  for (const f of floors) {
    if (Math.abs(x - f.x) > f.hw || Math.abs(z - f.z) > f.hd) continue;
    let v = 0;
    if (f.type === 'flat') v = f.h;
    else if (f.type === 'rampZ') v = f.h0 + ((z - (f.z - f.hd)) / (2 * f.hd)) * (f.h1 - f.h0);
    else v = Math.cos(((z - f.z) / f.hd) * (Math.PI / 2)) * f.h;
    if (v > h) h = v;
  }
  return h;
}

function pushOut(c: Collider, p: { x: number; z: number }, r: number) {
  if (c.type === 'circle') {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + r;
    if (d < min && d > 1e-6) {
      p.x = c.x + (dx / d) * min;
      p.z = c.z + (dz / d) * min;
    }
    return;
  }
  // 圓與軸對齊矩形
  const cx = Math.max(c.x - c.hw, Math.min(p.x, c.x + c.hw));
  const cz = Math.max(c.z - c.hd, Math.min(p.z, c.z + c.hd));
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * r;
    p.z = cz + (dz / d) * r;
  } else {
    // 圓心已在矩形內：往最近的邊推出
    const left = p.x - (c.x - c.hw);
    const right = c.x + c.hw - p.x;
    const top = p.z - (c.z - c.hd);
    const bottom = c.z + c.hd - p.z;
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = c.x - c.hw - r;
    else if (m === right) p.x = c.x + c.hw + r;
    else if (m === top) p.z = c.z - c.hd - r;
    else p.z = c.z + c.hd + r;
  }
}

/** 解析碰撞：多次迭代避免卡在兩個物件之間；最後限制在世界邊界內 */
export function resolveCollisions(layout: SceneLayout, p: { x: number; z: number }, r = PLAYER_RADIUS) {
  for (let i = 0; i < 3; i++) for (const c of layout.colliders) pushOut(c, p, r);
  const d = Math.hypot(p.x, p.z);
  if (d > layout.bounds) {
    p.x *= layout.bounds / d;
    p.z *= layout.bounds / d;
  }
}

/** 由牆段資料產生碰撞框（牆厚 t） */
export function wallColliders(segments: [number, number, number, number][], t = 0.3): Collider[] {
  return segments.map(([x1, z1, x2, z2]) => ({
    type: 'box',
    x: (x1 + x2) / 2,
    z: (z1 + z2) / 2,
    hw: Math.abs(x2 - x1) / 2 + t / 2,
    hd: Math.abs(z2 - z1) / 2 + t / 2,
  }));
}
