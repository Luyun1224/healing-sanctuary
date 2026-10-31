import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { SceneId } from '../config/scenes';
import type { AvatarConfig } from '../data/avatar';
import { churchLayout } from './layouts/church';
import { templeLayout } from './layouts/temple';
import { Clouds, Ground, Mist, Mountains, Stream } from './env/Valley';
import { Sky } from './env/Sky';
import { PhaseCtx, useDayPhase } from './env/useDayPhase';
import { ChurchScene } from './scenes/Church';
import { TempleScene } from './scenes/Temple';
import { Explore } from './scenes/Explore';
import { MoveMarker, Player } from './Player';
import { RemotePlayers } from './RemotePlayers';
import { useSettings } from './settings';
import { worldStore } from './worldStore';

export const LAYOUTS = { temple: templeLayout, church: churchLayout } as const;

export function WorldCanvas({ scene, avatar, nickname }: { scene: Exclude<SceneId, 'taoist'>; avatar: AvatarConfig; nickname: string }) {
  const quality = useSettings((s) => s.quality);
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const phase = useDayPhase();
  const low = quality === 'low';
  const layout = LAYOUTS[scene];

  const onGroundClick = (e: ThreeEvent<MouseEvent>) => {
    // 拖曳旋轉鏡頭時不觸發移動
    if (e.delta > 6) return;
    e.stopPropagation();
    worldStore.set({ moveTarget: [e.point.x, e.point.z] });
  };

  return (
    <Canvas
      key={quality}
      shadows={!low}
      dpr={low ? [1, 1.25] : [1, 2]}
      gl={{ antialias: !low, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.1, far: 900, position: [0, 7, 30] }}
    >
      <PhaseCtx.Provider value={phase}>
        <Sky phase={phase} reduceMotion={reduceMotion} low={low} />
        <Mountains low={low} />
        <Mist reduceMotion={reduceMotion} low={low} />
        <Clouds />
        <group onClick={onGroundClick}>
          <Ground />
          <Stream reduceMotion={reduceMotion} />
          {scene === 'temple' ? <TempleScene low={low} reduceMotion={reduceMotion} /> : <ChurchScene low={low} reduceMotion={reduceMotion} />}
          <Explore />
        </group>
        <MoveMarker layout={layout} />
        <Player layout={layout} avatar={avatar} nickname={nickname} />
        <RemotePlayers />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.1}
          minDistance={3.2}
          maxDistance={24}
          minPolarAngle={0.2}
          maxPolarAngle={1.42}
          rotateSpeed={0.6}
        />
      </PhaseCtx.Provider>
    </Canvas>
  );
}
