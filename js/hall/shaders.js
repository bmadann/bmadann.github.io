/*
 * GLSL for the hall's living effects: fire, magical auras, rune circles,
 * particles, moonbeams and the night sky.
 */
import * as THREE from "three";

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
`;

const UV_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Hearth / torch / candle flame drawn on a vertical quad. */
export function flameMaterial({ seed = 0, intensity = 1.6 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uIntensity: { value: intensity } },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uSeed, uIntensity;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        float t = uTime * 1.6 + uSeed * 10.0;
        float n = fbm(vec2(uv.x * 3.0 + uSeed, uv.y * 2.2 - t));
        float n2 = fbm(vec2(uv.x * 6.0 - uSeed, uv.y * 4.0 - t * 1.7));
        float width = mix(0.42, 0.02, pow(uv.y, 0.9));
        float d = abs(uv.x - 0.5 + (n - 0.5) * 0.28 * uv.y);
        float body = smoothstep(width, width * 0.2, d) * smoothstep(1.0, 0.25, uv.y + (n2 - 0.5) * 0.4);
        body *= smoothstep(0.0, 0.08, uv.y);
        float core = smoothstep(width * 0.55, 0.0, d) * smoothstep(0.7, 0.0, uv.y);
        vec3 col = mix(vec3(0.9, 0.12, 0.02), vec3(1.0, 0.55, 0.08), body);
        col = mix(col, vec3(1.0, 0.92, 0.65), core);
        float a = body * (0.85 + 0.15 * n2);
        gl_FragColor = vec4(col * uIntensity * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** Magical aura streaming along a sword blade. */
export function auraMaterial(color, { speed = 1, scale = 1, style = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: 0.35 },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uStyle: { value: style },
    },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uIntensity, uSpeed, uScale, uStyle;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        // vUv.y runs from the tip (0) to the hilt (1)
        float t = uTime * uSpeed;
        float taper = mix(0.12, 0.5, smoothstep(0.0, 0.25, vUv.y));
        float d = abs(vUv.x - 0.5);
        float shape = smoothstep(taper, taper * 0.15, d) * smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
        vec2 p = vec2(vUv.x * 3.0 * uScale, vUv.y * 5.0 * uScale);
        float n;
        if (uStyle < 0.5)      n = fbm(p - vec2(0.0, t * 1.4));                     // rising (fire, wood, time)
        else if (uStyle < 1.5) n = fbm(p + vec2(sin(p.y * 2.0 + t) * 0.5, -t));     // flowing (water, wind)
        else if (uStyle < 2.5) n = fbm(p * 1.5 + vec2(t * 0.2, t * 0.3));           // drifting (space, glass)
        else                   n = smoothstep(0.5, 0.75, fbm(p * 2.0 - vec2(0.0, t * 2.0)));  // crackling (earth, machinery)
        float wisps = smoothstep(0.35, 0.95, n);
        float a = shape * (0.2 + wisps) * uIntensity * 0.6;
        vec3 col = mix(uColor, vec3(1.0), smoothstep(0.8, 1.0, n) * 0.35);
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** Glowing rune circle where a sword pierces the table. */
export function runeCircleMaterial(color, runes = 9) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uIntensity: { value: 0.35 }, uRunes: { value: runes } },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uIntensity, uRunes;
      uniform vec3 uColor;
      varying vec2 vUv;
      float ring(float r, float c, float w) { return smoothstep(w, 0.0, abs(r - c)); }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float rot = a + uTime * 0.35;
        float rot2 = a - uTime * 0.22;
        float v = ring(r, 0.92, 0.02) + ring(r, 0.80, 0.012) * 0.8 + ring(r, 0.52, 0.015) * 0.7;
        // rune glyphs in the outer band
        float seg = fract(rot * uRunes * 2.0 / 6.2831853);
        float glyphId = floor(rot * uRunes * 2.0 / 6.2831853);
        float g = step(0.5, hash(vec2(glyphId, floor(seg * 4.0)))) * step(0.15, seg) * step(seg, 0.85);
        v += g * smoothstep(0.03, 0.0, abs(r - 0.86) - 0.03) * 0.9;
        // spokes in the inner band
        float spokes = smoothstep(0.08, 0.0, abs(fract(rot2 * 6.0 / 6.2831853) - 0.5) - 0.44);
        v += spokes * step(0.52, r) * step(r, 0.8) * 0.35;
        // inner sigil star
        float star = smoothstep(0.02, 0.0, abs(r - 0.34 - 0.08 * cos(a * 5.0 + uTime)));
        v += star * 0.8;
        float glow = exp(-r * 3.0) * 0.35;
        float alpha = (v + glow) * step(r, 1.0) * uIntensity;
        gl_FragColor = vec4(uColor * alpha * 1.6, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Expanding shockwave used when a sword is chosen. */
export function shockwaveMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uProgress: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `
      uniform float uProgress;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float r = length(vUv * 2.0 - 1.0);
        float w = 0.08 + 0.1 * uProgress;
        float ring = smoothstep(w, 0.0, abs(r - uProgress));
        float a = ring * (1.0 - uProgress) * 2.0;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.3) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Particle systems. Motion is computed entirely on the GPU from a per-particle
 * random seed; `mode` picks the behaviour for each element.
 */
export const PARTICLE_MODES = { fire: 0, water: 1, wind: 2, wood: 3, earth: 4, space: 5, machinery: 6, glass: 7, time: 8, embers: 9, dust: 10 };

export function particleMaterial(mode, color, { size = 1 } = {}) {
  return new THREE.ShaderMaterial({
    defines: { MODE: mode },
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.35 },
      uColor: { value: new THREE.Color(color) },
      uSize: { value: size * window.devicePixelRatio },
    },
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float uTime, uIntensity, uSize;
      uniform vec3 uColor;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSpin;
      const float TAU = 6.2831853;
      void main() {
        float t = uTime;
        vec3 p = vec3(0.0);
        float life = 0.0, s = 1.0;
        vColor = uColor;
        vSpin = seed.w * TAU;
        float speed = 0.6 + uIntensity * 0.6;
        #if MODE == 0
          life = fract(seed.x + t * 0.35 * speed);
          p = vec3((seed.z - 0.5) * 0.09, 0.12 + seed.y * 0.9 + life * 0.55, (seed.w - 0.5) * 0.05);
          p.x += sin(t * 3.0 + seed.w * 20.0) * 0.04 * life;
          p.z += cos(t * 2.3 + seed.z * 20.0) * 0.04 * life;
          vColor = mix(vec3(1.0, 0.85, 0.4), vec3(1.0, 0.18, 0.02), life);
          s = (1.0 - life) * 1.3;
        #elif MODE == 1
          life = fract(seed.z + t * 0.08 * speed);
          float a = seed.x * TAU + t * (0.8 + seed.y) * speed;
          float r = 0.11 + 0.05 * sin(t + seed.w * 6.0) + 0.03 * seed.y;
          p = vec3(cos(a) * r, 0.1 + life * 1.25, sin(a) * r);
          vColor = mix(uColor, vec3(0.9, 1.0, 1.0), seed.y);
          s = 0.6 + seed.w * 0.6;
        #elif MODE == 2
          life = fract(seed.z + t * 0.22 * speed);
          float a = seed.x * TAU + t * (2.6 + 2.0 * seed.y) * speed + life * 8.0;
          float r = 0.12 + 0.16 * seed.w + life * 0.08;
          p = vec3(cos(a) * r, life * 1.4, sin(a) * r);
          vColor = mix(uColor, vec3(1.0), 0.5);
          s = 0.5 + 0.5 * sin(life * 3.14159);
        #elif MODE == 3
          life = fract(seed.z + t * 0.05 * speed);
          float a = seed.x * TAU + t * 0.5 + life * 4.0;
          float r = 0.12 + 0.2 * seed.y;
          p = vec3(cos(a) * r, 1.45 - life * 1.4, sin(a) * r);
          p.x += sin(t * 2.0 + seed.w * 10.0) * 0.03;
          vColor = mix(vec3(0.45, 0.85, 0.2), vec3(0.95, 0.8, 0.25), step(0.7, seed.y));
          vSpin = t * (1.0 + seed.w * 2.0) + seed.w * TAU;
          s = 1.4;
        #elif MODE == 4
          float a = seed.x * TAU + t * 0.15 * speed;
          float r = 0.18 + 0.28 * seed.y;
          p = vec3(cos(a) * r, 0.05 + seed.z * 0.35 + sin(t + seed.w * 9.0) * 0.03, sin(a) * r);
          vColor = mix(uColor, vec3(0.55, 0.45, 0.35), 0.6);
          life = 0.5;
          s = 0.5 + seed.w;
        #elif MODE == 5
          float a = seed.x * TAU + t * 0.1;
          float e = (seed.y - 0.5) * 3.0;
          float r = 0.28 + 0.3 * seed.z;
          p = vec3(cos(a) * r * cos(e * 0.5), 0.95 + sin(e * 0.5) * r * 0.9 + 0.1, sin(a) * r * cos(e * 0.5));
          float tw = 0.5 + 0.5 * sin(t * (2.0 + seed.w * 4.0) + seed.x * 40.0);
          vColor = mix(uColor, vec3(1.0), tw * 0.8);
          s = 0.3 + tw * 0.9;
          life = 1.0 - tw * 0.6;
        #elif MODE == 6
          life = fract(seed.x + t * 0.9 * speed);
          vec3 dir = normalize(vec3(seed.y - 0.5, 0.6 + seed.z * 0.6, seed.w - 0.5));
          p = vec3(0.0, 1.0, 0.0) + dir * life * 0.5;
          p.y -= life * life * 0.6;
          vColor = mix(vec3(1.0, 0.95, 0.7), vec3(1.0, 0.45, 0.05), life);
          s = (1.0 - life) * 0.9;
        #elif MODE == 7
          float a = seed.x * TAU + t * 0.4 * (seed.y - 0.4);
          float r = 0.16 + 0.26 * seed.z;
          p = vec3(cos(a) * r, 0.2 + seed.y * 1.2, sin(a) * r);
          float tw = pow(0.5 + 0.5 * sin(t * (1.5 + seed.w * 3.0) + seed.x * 50.0), 6.0);
          vColor = 0.6 + 0.4 * cos(TAU * (seed.w + vec3(0.0, 0.33, 0.67)));
          s = 0.3 + tw * 1.8;
          life = 1.0 - tw;
          vSpin = 0.785;
        #elif MODE == 8
          life = fract(seed.z + t * 0.06 * speed);
          float a = seed.x * TAU - t * 0.5 - life * 3.0;
          float r = mix(0.35, 0.05, life) * (0.7 + 0.3 * seed.y);
          p = vec3(cos(a) * r, 1.35 - life * 1.1, sin(a) * r);
          vColor = mix(uColor, vec3(1.0, 0.95, 0.8), seed.w);
          s = 0.5 + 0.5 * seed.w;
        #elif MODE == 9
          life = fract(seed.x + t * 0.25);
          p = vec3((seed.y - 0.5) * 2.4, life * 3.2, (seed.z - 0.5) * 0.7);
          p.x += sin(t * 2.0 + seed.w * 30.0) * 0.18 * life;
          vColor = mix(vec3(1.0, 0.8, 0.3), vec3(1.0, 0.25, 0.02), life);
          s = (1.0 - life) * 1.2;
        #else
          float a = t * 0.02 + seed.x * TAU;
          p = vec3((seed.y - 0.5) * 2.0 + sin(t * 0.1 + seed.w * 9.0) * 0.1, seed.z, (seed.w - 0.5) * 2.0);
          float tw = 0.5 + 0.5 * sin(t * 0.7 + seed.x * 30.0);
          vColor = uColor;
          s = 0.6 + tw * 0.6;
          life = 1.0 - tw * 0.7;
        #endif
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(uSize * s * (60.0 / -mv.z) * (0.7 + uIntensity * 0.5), 26.0 * uSize);
        #if MODE == 4 || MODE == 5 || MODE == 7 || MODE == 10
          vAlpha = (1.0 - life * 0.8) * clamp(uIntensity * 1.4, 0.3, 1.5);
        #else
          vAlpha = sin(clamp(life, 0.0, 1.0) * 3.14159) * clamp(uIntensity * 1.4, 0.3, 1.5);
        #endif
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSpin;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float c = cos(vSpin), s = sin(vSpin);
        p = mat2(c, -s, s, c) * p;
        float a;
        #if MODE == 3
          a = smoothstep(1.0, 0.7, length(p * vec2(1.0, 2.4)));        // leaf
        #elif MODE == 7
          a = max(smoothstep(0.18, 0.0, abs(p.x)) * smoothstep(1.0, 0.0, abs(p.y)),
                  smoothstep(0.18, 0.0, abs(p.y)) * smoothstep(1.0, 0.0, abs(p.x)));  // glint
          a = max(a, smoothstep(0.5, 0.0, length(p)));
        #else
          a = smoothstep(1.0, 0.0, length(p));
          a *= a;
        #endif
        a *= vAlpha;
        gl_FragColor = vec4(vColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Points object with `count` random seeds, drawn with particleMaterial. */
export function particles(count, material, seedValue = 1) {
  const g = new THREE.BufferGeometry();
  const seeds = new Float32Array(count * 4);
  let s = seedValue * 9301 + 49297;
  for (let i = 0; i < seeds.length; i++) { s = (s * 16807) % 2147483647; seeds[i] = s / 2147483647; }
  g.setAttribute("seed", new THREE.BufferAttribute(seeds, 4));
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const pts = new THREE.Points(g, material);
  pts.frustumCulled = false;
  return pts;
}

/** Moonbeam: a soft volumetric shaft with drifting dust. */
export function moonbeamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN, vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vN, vView;
      void main() {
        float edge = pow(abs(dot(vN, vView)), 1.6);
        float along = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
        float n = fbm(vec2(vUv.x * 8.0 + uTime * 0.03, vUv.y * 3.0 - uTime * 0.05));
        float a = edge * along * (0.55 + 0.45 * n) * 0.16;
        gl_FragColor = vec4(vec3(0.62, 0.72, 1.0) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** The night seen through the window: moon, drifting clouds, stars. */
export function nightSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        vec3 col = mix(vec3(0.02, 0.03, 0.08), vec3(0.08, 0.12, 0.26), uv.y);
        float stars = step(0.996, hash(floor(uv * vec2(220.0, 420.0)))) * (0.5 + 0.5 * sin(uTime * 2.0 + uv.x * 90.0));
        col += stars * 0.8;
        vec2 m = vec2(0.66, 0.74);
        float d = length((uv - m) * vec2(1.0, 2.0));
        float moon = smoothstep(0.1, 0.092, d);
        float craters = fbm(uv * 30.0) * 0.25;
        col = mix(col, vec3(0.92, 0.94, 1.0) - craters, moon);
        col += vec3(0.5, 0.6, 0.9) * exp(-d * 9.0) * 0.8;
        float clouds = smoothstep(0.45, 0.8, fbm(vec2(uv.x * 2.5 + uTime * 0.012, uv.y * 5.0)));
        col = mix(col, vec3(0.16, 0.18, 0.26) + exp(-d * 5.0) * 0.4, clouds * 0.75);
        gl_FragColor = vec4(col * 1.4, 1.0);
      }`,
  });
}
