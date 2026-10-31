import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { DayPhase } from '../../lib/timeOfDay';
import { getGlowTexture } from './prims';

/**
 * 晝夜光照（擴充自 OSCE Island 的 SkyRig）：清晨／白天／黃昏／夜晚四個時段，
 * 天空漸層、霧色、陽光方向與強度在切換時平滑過渡。
 */
interface Palette {
  top: string;
  horizon: string;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  sun: string;
  sunI: number;
  sunPos: [number, number, number];
  disc: string;
}

export const PALETTES: Record<DayPhase, Palette> = {
  dawn: { top: '#9fb8d9', horizon: '#f6d3bd', hemiSky: '#ffe6d2', hemiGround: '#7d9a7a', hemi: 0.75, sun: '#ffcf9e', sunI: 1.2, sunPos: [60, 18, 20], disc: '#ffd9a8' },
  day: { top: '#8fc3e6', horizon: '#e3efef', hemiSky: '#ffffff', hemiGround: '#8fb08a', hemi: 0.9, sun: '#fff4df', sunI: 1.75, sunPos: [28, 55, 22], disc: '#fff8e1' },
  dusk: { top: '#7f86b8', horizon: '#f2b48c', hemiSky: '#ffd3b0', hemiGround: '#6d7a6a', hemi: 0.65, sun: '#ffab73', sunI: 1.15, sunPos: [-60, 16, -10], disc: '#ffb27a' },
  night: { top: '#0c1430', horizon: '#2c3a63', hemiSky: '#8193d6', hemiGround: '#1c2b2a', hemi: 0.42, sun: '#a9bcff', sunI: 0.45, sunPos: [-30, 50, -40], disc: '#f6f1d6' },
};

const tmp = new THREE.Color();

const skyVert = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
}`;
const skyFrag = /* glsl */ `
uniform vec3 top;
uniform vec3 horizon;
varying vec3 vPos;
void main() {
  float h = normalize(vPos - cameraPosition).y;
  float k = smoothstep(-0.02, 0.45, h);
  gl_FragColor = vec4(mix(horizon, top, k), 1.0);
  #include <colorspace_fragment>
}`;

export function Sky({ phase, reduceMotion, low }: { phase: DayPhase; reduceMotion: boolean; low: boolean }) {
  const scene = useThree((s) => s.scene);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const disc = useRef<THREE.Sprite>(null);
  const fog = useMemo(() => new THREE.Fog(PALETTES.day.horizon, 55, 270), []);
  const uniforms = useMemo(() => ({ top: { value: new THREE.Color(PALETTES[phase].top) }, horizon: { value: new THREE.Color(PALETTES[phase].horizon) } }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const sunTarget = useMemo(() => new THREE.Vector3(), []);
  const first = useRef(true);

  useMemo(() => {
    scene.fog = fog;
  }, [scene, fog]);

  useFrame((_, dt) => {
    const p = PALETTES[phase];
    const k = first.current ? 1 : 1 - Math.exp(-dt * 1.5);
    first.current = false;
    uniforms.top.value.lerp(tmp.set(p.top), k);
    uniforms.horizon.value.lerp(tmp.set(p.horizon), k);
    fog.color.copy(uniforms.horizon.value);
    if (hemi.current) {
      hemi.current.color.lerp(tmp.set(p.hemiSky), k);
      hemi.current.groundColor.lerp(tmp.set(p.hemiGround), k);
      hemi.current.intensity += (p.hemi - hemi.current.intensity) * k;
    }
    if (sun.current) {
      sun.current.color.lerp(tmp.set(p.sun), k);
      sun.current.intensity += (p.sunI - sun.current.intensity) * k;
      sun.current.position.lerp(sunTarget.set(...p.sunPos), k);
    }
    if (disc.current && sun.current) {
      disc.current.position.copy(sun.current.position).normalize().multiplyScalar(300);
      (disc.current.material as THREE.SpriteMaterial).color.lerp(tmp.set(p.disc), k);
    }
  });

  const night = phase === 'night';
  return (
    <>
      <mesh scale={420} renderOrder={-1}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial vertexShader={skyVert} fragmentShader={skyFrag} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <sprite ref={disc} scale={night ? 26 : 46}>
        <spriteMaterial map={getGlowTexture()} transparent depthWrite={false} fog={false} opacity={night ? 1 : 0.9} />
      </sprite>
      <hemisphereLight ref={hemi} args={[PALETTES.day.hemiSky, PALETTES.day.hemiGround, PALETTES.day.hemi]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        ref={sun}
        position={PALETTES.day.sunPos}
        intensity={PALETTES.day.sunI}
        castShadow={!low}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {night && <Stars radius={300} depth={60} count={low ? 1200 : 2600} factor={6} saturation={0.15} fade speed={reduceMotion ? 0 : 0.5} />}
      {(night || phase === 'dusk') && (
        // 螢火蟲
        <Sparkles count={low ? 40 : 110} scale={[60, 4, 60]} position={[0, 1.8, 2]} size={night ? 6 : 3} speed={reduceMotion ? 0.05 : 0.3} color="#f8e58c" opacity={night ? 0.9 : 0.45} />
      )}
    </>
  );
}
