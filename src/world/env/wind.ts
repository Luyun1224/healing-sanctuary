import * as THREE from 'three';

/** 全域風力 uniform：樹木、竹子、花草在頂點著色器中依高度擺動（GPU 計算，不佔 CPU） */
export const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };

export function windMaterial(color: string, strength: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...opts });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float hh = max(position.y, 0.0);
        vec3 org = vec3(0.0);
        #ifdef USE_INSTANCING
          org = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #endif
        float sway = (sin(uTime * 1.25 + org.x * 0.31 + org.z * 0.23) * 0.7 + sin(uTime * 2.3 + org.x * 0.7) * 0.3) * uWind * ${strength.toFixed(4)} * hh * hh;
        transformed.x += sway;
        transformed.z += sway * 0.45;`,
      );
  };
  m.customProgramCacheKey = () => `wind-${strength}`;
  return m;
}
