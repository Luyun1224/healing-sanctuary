import { Box, Cone, Cyl, GableRoof, HipRoof, Sphere } from '../env/prims';

/** 入口山谷與預覽卡片使用的簡化建築模型 */
export function MiniTemple() {
  return (
    <group>
      <Box size={[5.4, 0.4, 4.4]} position={[0, 0.2, 0]} color="#cfc6b4" />
      <Box size={[4.4, 2, 3.4]} position={[0, 1.4, 0]} color="#efe2c8" />
      {[-2.2, -0.75, 0.75, 2.2].map((x) => (
        <Cyl key={x} args={[0.12, 0.13, 2.1, 8]} position={[x, 1.45, 1.75]} color="#a0623e" />
      ))}
      <Box size={[1.2, 1.5, 0.1]} position={[0, 1.15, 1.72]} color="#7b4a2f" />
      <HipRoof width={6.4} depth={5.4} height={1.3} position={[0, 2.4, 0]} color="#55615c" />
      <Box size={[2.6, 0.5, 1.6]} position={[0, 3.4, 0]} color="#a0623e" />
      <HipRoof width={3.8} depth={2.8} height={1} position={[0, 3.6, 0]} color="#55615c" />
      <Sphere r={0.14} position={[0, 4.7, 0]} color="#d9a944" metalness={0.4} />
      {[-1.6, 1.6].map((x) => (
        <Sphere key={x} r={0.18} position={[x, 2.15, 2.2]} scale={[1, 1.2, 1]} color="#e0553f" emissive="#ff8a55" emissiveIntensity={0.6} />
      ))}
    </group>
  );
}

export function MiniChurch() {
  return (
    <group>
      <Box size={[4, 0.3, 6]} position={[0, 0.15, 0]} color="#dcd5c6" />
      <Box size={[3.4, 2.4, 5.2]} position={[0, 1.5, 0]} color="#f3eee4" />
      <group position={[0, 2.7, 0]} rotation={[0, Math.PI / 2, 0]}>
        {[-1, 1].map((s) => (
          <Box key={s} size={[5.8, 0.14, 2.3]} position={[0, 0.8, s * 0.85]} rotation={[s * 0.72, 0, 0]} color="#9fb4cc" />
        ))}
      </group>
      <GableRoof width={3.4} depth={0.2} height={1.6} position={[0, 2.7, 2.6]} color="#f3eee4" />
      <Box size={[1, 1.6, 0.1]} position={[0, 1.1, 2.62]} color="#9a6a42" />
      <mesh position={[0, 3.3, 2.72]}>
        <circleGeometry args={[0.4, 20]} />
        <meshStandardMaterial color="#e9b44c" emissive="#f4c662" emissiveIntensity={0.5} />
      </mesh>
      <Box size={[1.4, 5, 1.4]} position={[-2.4, 2.5, 1.6]} color="#f3eee4" />
      <Cone r={1.1} h={2} seg={4} position={[-2.4, 6, 1.6]} rotation={[0, Math.PI / 4, 0]} color="#9fb4cc" />
      <group position={[-2.4, 7.5, 1.6]}>
        <Box size={[0.1, 0.8, 0.1]} color="#d9b25a" />
        <Box size={[0.45, 0.1, 0.1]} position={[0, 0.12, 0]} color="#d9b25a" />
      </group>
    </group>
  );
}
