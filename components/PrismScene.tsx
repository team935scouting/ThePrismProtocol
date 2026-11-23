"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshTransmissionMaterial } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/*
 * Six coloured beams — one per scout in the stands — converge on a glass prism and
 * leave as a single white beam. Recombining a spectrum is Newton's second-prism
 * experiment, and it's also exactly what Prism does: many devices in, one stream out.
 * Pulses travelling along the beams are records in flight.
 */

const SCOUT_COLORS = ["#ff453a", "#ff9f0a", "#ffd60a", "#30d158", "#40a9ff", "#8e7dff"];
const BG = "#050507";

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uSpeed;
  uniform float uOffset;
  uniform float uFadeIn;
  uniform float uFadeOut;
  varying vec2 vUv;
  void main() {
    float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
    float core = pow(across, 5.0);
    float halo = pow(across, 1.6) * 0.42;
    float along = smoothstep(0.0, uFadeIn, vUv.x) * (1.0 - smoothstep(1.0 - uFadeOut, 1.0, vUv.x));
    float p = fract(vUv.x * 1.3 - uTime * uSpeed + uOffset);
    float pulse = smoothstep(0.0, 0.03, p) * (1.0 - smoothstep(0.03, 0.14, p));
    vec3 col = uColor * (core * 1.5 + halo) + vec3(core * 0.45) + uColor * pulse * pow(across, 2.0) * 1.6;
    gl_FragColor = vec4(col * along * uOpacity, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float g = pow(max(0.0, 1.0 - d * 2.0), 3.0) * 0.32;
    gl_FragColor = vec4(vec3(0.82, 0.88, 1.0) * g, 1.0);
  }
`;

type BeamProps = {
  from: [number, number];
  to: [number, number];
  w0: number;
  w1: number;
  color: string;
  speed?: number;
  offset?: number;
  opacity?: number;
  fadeIn?: number;
  fadeOut?: number;
  timeRef: React.RefObject<number>;
};

function Beam({ from, to, w0, w1, color, speed = 0.22, offset = 0, opacity = 1, fadeIn = 0.35, fadeOut = 0.04, timeRef }: BeamProps) {
  const geometry = useMemo(() => {
    const [x0, y0] = from;
    const [x1, y1] = to;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const px = -(y1 - y0) / len;
    const py = (x1 - x0) / len;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          x0 - (px * w0) / 2, y0 - (py * w0) / 2, 0,
          x0 + (px * w0) / 2, y0 + (py * w0) / 2, 0,
          x1 - (px * w1) / 2, y1 - (py * w1) / 2, 0,
          x1 + (px * w1) / 2, y1 + (py * w1) / 2, 0,
        ],
        3,
      ),
    );
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0, 1, 1], 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    return g;
  }, [from, to, w0, w1]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        side: THREE.DoubleSide,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uTime: { value: 0 },
          uOpacity: { value: opacity },
          uSpeed: { value: speed },
          uOffset: { value: offset },
          uFadeIn: { value: fadeIn },
          uFadeOut: { value: fadeOut },
        },
      }),
    [color, opacity, speed, offset, fadeIn, fadeOut],
  );

  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = mesh.current?.material as THREE.ShaderMaterial | undefined;
    if (m) m.uniforms.uTime.value = timeRef.current ?? 0;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={-1} />;
}

function prismGeometry() {
  const R = 1.22; // circumradius of the triangular face
  const cr = 0.16; // corner rounding
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

function Rig({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const prism = useRef<THREE.Mesh>(null);
  const time = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
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

  useFrame((_, dt) => {
    if (!reduced) time.current += Math.min(dt, 0.05);
    const g = group.current;
    const p = prism.current;
    if (!g || !p) return;
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.05));
    p.rotation.y += (-0.38 + pointer.current.x * 0.22 - p.rotation.y) * k;
    p.rotation.x += (0.1 + pointer.current.y * 0.12 - p.rotation.x) * k;
  });

  const entry: [number, number] = [-0.42, 0.02];
  const exit: [number, number] = [0.42, -0.06];

  return (
    <group ref={group} position={layout.pos} scale={layout.scale}>
      {SCOUT_COLORS.map((c, i) => {
        const spread = (i - 2.5) / 2.5; // -1 .. 1
        return (
          <Beam
            key={c}
            from={[-9.5, spread * 3.1 + 0.4]}
            to={entry}
            w0={0.1}
            w1={0.05}
            color={c}
            offset={i * 0.17}
            speed={0.12 + i * 0.012}
            opacity={0.78}
            fadeIn={0.45}
            fadeOut={0.02}
            timeRef={time}
          />
        );
      })}
      <Beam
        from={exit}
        to={[10, -1.15]}
        w0={0.07}
        w1={0.22}
        color="#ffffff"
        offset={0.5}
        speed={0.16}
        opacity={1.1}
        fadeIn={0.03}
        fadeOut={0.5}
        timeRef={time}
      />
      <mesh position={[0.1, 0, -1.6]} renderOrder={-2}>
        <planeGeometry args={[5, 5]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          vertexShader={vertex}
          fragmentShader={glowFragment}
        />
      </mesh>
      <mesh ref={prism} geometry={geometry} rotation={[0.1, -0.38, 0]}>
        <MeshTransmissionMaterial
          background={bg}
          transmission={1}
          thickness={1.5}
          roughness={0.035}
          ior={1.52}
          chromaticAberration={0.45}
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

export default function PrismScene({ active, reduced, onReady }: { active: boolean; reduced: boolean; onReady?: () => void }) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 10], fov: 30 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
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
      <Rig reduced={reduced} />
    </Canvas>
  );
}
