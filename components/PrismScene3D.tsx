"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshTransmissionMaterial } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/*
 * Six coloured beams — one per scout — converge on a glass prism and leave as one.
 *
 * The light is traced, not drawn: every frame the beams are intersected with the
 * prism's actual faces (at its current rotation) and bent with Snell's law, using a
 * slightly different index of refraction per colour. Turn the prism and:
 *   - the surface reflections sweep across the scene, brighter at grazing angles (Fresnel)
 *   - the internal path moves, and can totally internally reflect off a second face
 *   - the exit beam swings, and its edges split into a spectrum as dispersion grows
 */

type V = [number, number];
export type PrismControls = { drag: number; scroll: number };

const SCOUTS = [
  { color: "#ff3b30", ior: 1.505 },
  { color: "#ff9500", ior: 1.509 },
  { color: "#ffd60a", ior: 1.513 },
  { color: "#34c759", ior: 1.518 },
  { color: "#0a84ff", ior: 1.526 },
  { color: "#7a5cff", ior: 1.535 },
];
const GLASS_IOR = 1.518;
const BG = "#050507";
const R = 1.22; // circumradius of the prism's triangular face
const LONG = 14;

/* ---------- 2D optics ---------- */

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
const cross = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
const rot = (a: V, t: number): V => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];

// Matches ExtrudeGeometry.center(): the bounding box, not the centroid, sits at the origin.
const C = R / 4;
const BASE: V[] = [
  [0, R - C],
  [-R * Math.cos(Math.PI / 6), -R / 2 - C],
  [R * Math.cos(Math.PI / 6), -R / 2 - C],
];
const CENTROID: V = [0, -C];

type Hit = { t: number; p: V; n: V; edge: number };

function intersect(p: V, d: V, verts: V[], centroid: V, skip = -1): Hit | null {
  let best: Hit | null = null;
  for (let i = 0; i < 3; i++) {
    if (i === skip) continue;
    const a = verts[i];
    const e = sub(verts[(i + 1) % 3], a);
    const den = cross(d, e);
    if (Math.abs(den) < 1e-8) continue;
    const ap = sub(a, p);
    const t = cross(ap, e) / den;
    const u = cross(ap, d) / den;
    if (t > 1e-4 && u >= 0 && u <= 1 && (!best || t < best.t)) {
      let n = norm([e[1], -e[0]]);
      const mid = add(a, mul(e, 0.5));
      if (dot(n, sub(mid, centroid)) < 0) n = mul(n, -1); // outward
      best = { t, p: add(p, mul(d, t)), n, edge: i };
    }
  }
  return best;
}

/** n faces against d. eta = n1 / n2. Returns null on total internal reflection. */
function refract(d: V, n: V, eta: number): V | null {
  const cosi = -dot(n, d);
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  return norm(add(mul(d, eta), mul(n, eta * cosi - Math.sqrt(k))));
}
const reflect = (d: V, n: V): V => sub(d, mul(n, 2 * dot(d, n)));
function fresnel(cosi: number, n1: number, n2: number) {
  const r0 = ((n1 - n2) / (n1 + n2)) ** 2;
  return r0 + (1 - r0) * Math.pow(1 - Math.abs(cosi), 5);
}

/* ---------- Beam rendering ---------- */

type BeamState = { from: V; to: V; w0: number; w1: number; intensity: number };
type Box<T> = { current: T };
const hidden = (): BeamState => ({ from: [0, 0], to: [0.001, 0], w0: 0, w1: 0, intensity: 0 });

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A beam of light in a slightly hazy room: a hot core, a soft scattering halo,
// drifting dust in the halo, and falloff with distance.
const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uLen;
  uniform float uFadeIn;
  uniform float uFadeOut;
  uniform float uPulse;
  uniform float uSeed;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float x = vUv.y * 2.0 - 1.0;
    float s = vUv.x;
    float core = exp(-x * x * 70.0);
    float halo = exp(-x * x * 5.0);
    float along = smoothstep(0.0, uFadeIn, s) * (1.0 - smoothstep(1.0 - uFadeOut, 1.0, s));

    vec2 q = vec2(s * uLen * 2.2 - uTime * 0.35 + uSeed * 13.0, x * 1.6);
    float haze = noise(q) * 0.6 + noise(q * 2.7 + uTime * 0.1) * 0.4;
    float dust = smoothstep(0.82, 1.0, noise(vec2(s * uLen * 9.0 + uSeed * 7.0 - uTime * 0.6, x * 9.0)));

    float p = fract(s * uLen * 0.09 - uTime * 0.22 + uSeed);
    float pulse = smoothstep(0.0, 0.02, p) * (1.0 - smoothstep(0.02, 0.1, p)) * uPulse;

    vec3 c = uColor * (core * 2.2 + halo * (0.12 + 0.2 * haze) + dust * halo * 0.45)
           + vec3(core * 0.7)
           + uColor * pulse * exp(-x * x * 12.0) * 2.0;
    gl_FragColor = vec4(c * along * uIntensity, 1.0);
  }
`;

function Beam({
  frame,
  pick,
  color,
  seed,
  fadeIn = 0.25,
  fadeOut = 0.35,
  pulse = 0,
  timeRef,
}: {
  frame: Box<Frame>;
  pick: (f: Frame) => BeamState;
  color: string;
  seed: number;
  fadeIn?: number;
  fadeOut?: number;
  pulse?: number;
  timeRef: Box<number>;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0, 1, 1], 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uLen: { value: 1 },
          uFadeIn: { value: fadeIn },
          uFadeOut: { value: fadeOut },
          uPulse: { value: pulse },
          uSeed: { value: seed },
        },
      }),
    [color, fadeIn, fadeOut, pulse, seed],
  );

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const b = pick(frame.current);
    const [x0, y0] = b.from;
    const [x1, y1] = b.to;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1e-3;
    const px = -(y1 - y0) / len;
    const py = (x1 - x0) / len;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    pos.setXYZ(0, x0 - (px * b.w0) / 2, y0 - (py * b.w0) / 2, 0);
    pos.setXYZ(1, x0 + (px * b.w0) / 2, y0 + (py * b.w0) / 2, 0);
    pos.setXYZ(2, x1 - (px * b.w1) / 2, y1 - (py * b.w1) / 2, 0);
    pos.setXYZ(3, x1 + (px * b.w1) / 2, y1 + (py * b.w1) / 2, 0);
    pos.needsUpdate = true;
    const mat = m.material as THREE.ShaderMaterial;
    mat.uniforms.uIntensity.value = b.intensity;
    mat.uniforms.uLen.value = len;
    mat.uniforms.uTime.value = timeRef.current;
    m.visible = b.intensity > 0.002;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />;
}

/** Where light meets glass, the surface itself glows. */
const spotFragment = /* glsl */ `
  uniform float uIntensity;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float d = distance(vUv, vec2(0.5)) * 2.0;
    float g = exp(-d * d * 9.0) * 1.6 + exp(-d * d * 60.0) * 2.5;
    gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
  }
`;

type SpotState = { p: V; intensity: number; size: number };

function Spot({ frame, pick }: { frame: Box<Frame>; pick: (f: Frame) => SpotState }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: spotFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uIntensity: { value: 0 }, uColor: { value: new THREE.Color("#eef3ff") } },
      }),
    [],
  );
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const s = pick(frame.current);
    m.position.set(s.p[0], s.p[1], 0.05);
    m.scale.setScalar(s.size);
    (m.material as THREE.ShaderMaterial).uniforms.uIntensity.value = s.intensity;
  });
  return (
    <mesh ref={mesh} material={material} renderOrder={3} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

/* ---------- Prism ---------- */

function prismGeometry() {
  const cr = 0.16;
  const pts = [90, 210, 330].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R);
  });
  const shape = new THREE.Shape();
  pts.forEach((p, i) => {
    const prev = pts[(i + 2) % 3];
    const next = pts[(i + 1) % 3];
    const a = p.clone().add(prev.clone().sub(p).setLength(cr * 2.2));
    const b = p.clone().add(next.clone().sub(p).setLength(cr * 2.2));
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(p.x, p.y, b.x, b.y);
  });
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 1.5,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.05,
    bevelSegments: 8,
    curveSegments: 24,
  });
  g.center();
  return g;
}

const glowFragment = /* glsl */ `
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float g = pow(max(0.0, 1.0 - d * 2.0), 3.0) * 0.3 * uIntensity;
    gl_FragColor = vec4(vec3(0.82, 0.88, 1.0) * g, 1.0);
  }
`;

/** All light paths for one frame, traced from the prism's current in-plane rotation. */
function trace(theta: number) {
  const incoming = SCOUTS.map(hidden);
  const reflected = SCOUTS.map(hidden);
  const fringes = SCOUTS.map(hidden);
  let inner = hidden();
  let bounce = hidden();
  let exit = hidden();
  const entry: SpotState = { p: [0, 0], intensity: 0, size: 1.1 };
  const exitSpot: SpotState = { p: [0, 0], intensity: 0, size: 1.3 };
  let energy = 0;
  const result = () => ({ incoming, reflected, fringes, inner, bounce, exit, entry, exitSpot, energy });

  const verts = BASE.map((v) => rot(v, theta));
  const centroid = rot(CENTROID, theta);
  const d0 = norm([1, -0.1]);
  const hit = intersect(sub([-0.45, 0.12], mul(d0, 10)), d0, verts, centroid);
  if (!hit) return result();
  const E = hit.p;
  const nIn = hit.n;
  entry.p = E;
  entry.intensity = 0.22;

  let flux = 0;
  SCOUTS.forEach((s, i) => {
    const ang = Math.atan2(d0[1], d0[0]) + (i - 2.5) * 0.06;
    const d: V = [Math.cos(ang), Math.sin(ang)];
    const cosi = -dot(nIn, d);
    incoming[i] = { from: sub(E, mul(d, LONG)), to: E, w0: 0.55, w1: 0.22, intensity: 0.5 };
    const Rf = cosi > 0 ? fresnel(cosi, 1, s.ior) : 1;
    flux += 1 - Rf;
    reflected[i] = {
      from: E,
      to: add(E, mul(reflect(d, nIn), LONG * 0.6)),
      w0: 0.2,
      w1: 1.0,
      intensity: cosi > 0 ? Math.min(0.75, 0.02 + Rf * 3) : 0,
    };
  });
  energy = flux / SCOUTS.length;

  const t = refract(d0, nIn, 1 / GLASS_IOR);
  if (!t) return result();

  // Inside the glass: follow the ray, allowing one total internal reflection.
  let p = E;
  let dir = t;
  let edge = hit.edge;
  let out: { X: V; n: V; dir: V; internal: V } | null = null;
  for (let n = 0; n < 2 && !out; n++) {
    const h = intersect(p, dir, verts, centroid, edge);
    if (!h) break;
    const inside = mul(h.n, -1);
    const cosi = -dot(inside, dir);
    const beam = { from: p, to: h.p, w0: 0.3, w1: 0.3, intensity: energy * 0.7 };
    if (n === 0) inner = beam;
    else bounce = beam;
    const refracted = refract(dir, inside, GLASS_IOR);
    if (refracted) {
      out = { X: h.p, n: h.n, dir: refracted, internal: dir };
      energy *= 1 - fresnel(cosi, GLASS_IOR, 1);
    } else {
      dir = reflect(dir, inside);
      p = h.p;
      edge = h.edge;
    }
  }
  if (!out) return result();

  const { X } = out;
  exit = { from: X, to: add(X, mul(out.dir, LONG)), w0: 0.28, w1: 1.3, intensity: energy * 0.95 };
  exitSpot.p = X;
  exitSpot.intensity = energy * 0.3;
  SCOUTS.forEach((s, i) => {
    const f = refract(out.internal, mul(out.n, -1), s.ior);
    if (f) fringes[i] = { from: X, to: add(X, mul(f, LONG)), w0: 0.1, w1: 0.9, intensity: energy * 0.3 };
  });
  return result();
}

type Frame = ReturnType<typeof trace>;

function Rig({ reduced, controls }: { reduced: boolean; controls: Box<PrismControls> }) {
  const prism = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.ShaderMaterial>(null);
  const time = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const angle = useRef({ z: 0, x: 0.1, y: -0.32 });
  const frame = useRef<Frame>(trace(0));
  const { viewport, size } = useThree();
  const geometry = useMemo(() => prismGeometry(), []);
  const bg = useMemo(() => new THREE.Color(BG), []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const narrow = size.width / size.height < 0.95;
  const layout = narrow
    ? { pos: [0, viewport.height * 0.17, 0] as const, scale: Math.min(0.72, viewport.width / 5.2) }
    : { pos: [viewport.width * 0.2, viewport.height * 0.1, 0] as const, scale: Math.min(1, viewport.width / 8.5) };

  // Runs before the beams read the trace.
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    if (!reduced) time.current += step;
    const c = controls.current;

    // Pointer gives a generous lean, scrolling turns it, dragging spins it.
    const target = {
      z: -pointer.current.x * 0.42 + c.scroll * 0.55 + c.drag,
      x: 0.1 + pointer.current.y * 0.28,
      y: -0.32 + pointer.current.x * 0.38,
    };
    const k = 1 - Math.pow(0.0015, step);
    const a = angle.current;
    a.z += (target.z - a.z) * k;
    a.x += (target.x - a.x) * k;
    a.y += (target.y - a.y) * k;
    prism.current?.rotation.set(a.x, a.y, a.z);

    frame.current = trace(a.z);
    if (glow.current) glow.current.uniforms.uIntensity.value = 0.6 + frame.current.energy * 0.8;
  }, -1);

  return (
    <group position={layout.pos} scale={layout.scale}>
      <mesh position={[0.1, 0, -1.6]} renderOrder={-2}>
        <planeGeometry args={[5, 5]} />
        <shaderMaterial
          ref={glow}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          vertexShader={vertex}
          fragmentShader={glowFragment}
          uniforms={{ uIntensity: { value: 1 } }}
        />
      </mesh>

      {SCOUTS.map((s, i) => (
        <Beam key={`in-${i}`} frame={frame} pick={(f) => f.incoming[i]} color={s.color} seed={i * 0.17} fadeIn={0.55} fadeOut={0.01} pulse={1} timeRef={time} />
      ))}
      {SCOUTS.map((s, i) => (
        <Beam key={`rf-${i}`} frame={frame} pick={(f) => f.reflected[i]} color={s.color} seed={i * 0.31 + 3} fadeIn={0.02} fadeOut={0.75} timeRef={time} />
      ))}
      <Beam frame={frame} pick={(f) => f.inner} color="#f4f7ff" seed={5.1} fadeIn={0.05} fadeOut={0.05} timeRef={time} />
      <Beam frame={frame} pick={(f) => f.bounce} color="#f4f7ff" seed={6.3} fadeIn={0.05} fadeOut={0.05} timeRef={time} />
      {SCOUTS.map((s, i) => (
        <Beam key={`fr-${i}`} frame={frame} pick={(f) => f.fringes[i]} color={s.color} seed={i * 0.23 + 9} fadeIn={0.02} fadeOut={0.6} timeRef={time} />
      ))}
      <Beam frame={frame} pick={(f) => f.exit} color="#ffffff" seed={2.7} fadeIn={0.01} fadeOut={0.55} pulse={1} timeRef={time} />
      <Spot frame={frame} pick={(f) => f.entry} />
      <Spot frame={frame} pick={(f) => f.exitSpot} />

      <mesh ref={prism} geometry={geometry} rotation={[0.1, -0.32, 0]} renderOrder={1}>
        <MeshTransmissionMaterial
          background={bg}
          transmission={1}
          thickness={1.5}
          roughness={0.035}
          ior={1.52}
          chromaticAberration={0.5}
          anisotropicBlur={0.12}
          distortion={0.06}
          distortionScale={0.25}
          temporalDistortion={0}
          samples={6}
          resolution={768}
          backside
          backsideThickness={0.5}
          clearcoat={1}
          clearcoatRoughness={0.08}
          attenuationDistance={4}
          attenuationColor="#f2f6ff"
          color="#ffffff"
        />
      </mesh>
    </group>
  );
}

export default function PrismScene({
  active,
  reduced,
  controls,
  onReady,
}: {
  active: boolean;
  reduced: boolean;
  controls: Box<PrismControls>;
  onReady?: () => void;
}) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 10], fov: 30 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(BG);
        requestAnimationFrame(() => onReady?.());
      }}
      aria-hidden="true"
    >
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={5} position={[0, 5, -4]} rotation-x={Math.PI / 2} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={3} position={[-7, 0.5, 1]} rotation-y={Math.PI / 2} scale={[12, 1.2, 1]} />
        <Lightformer form="rect" intensity={2.4} position={[7, -0.5, 1]} rotation-y={-Math.PI / 2} scale={[12, 1.2, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[0, -5, 2]} rotation-x={-Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer form="ring" intensity={6} position={[3, 3, 6]} scale={2.2} />
      </Environment>
      <Rig reduced={reduced} controls={controls} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={0.7} luminanceSmoothing={0.25} intensity={0.75} radius={0.65} />
      </EffectComposer>
    </Canvas>
  );
}
