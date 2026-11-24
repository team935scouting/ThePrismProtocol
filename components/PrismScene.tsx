"use client";

import { useEffect, useRef } from "react";
import styles from "./PrismScene.module.css";

/*
 * A real prism, path traced. White light enters a glass prism and leaves split into
 * its spectrum: every ray carries a wavelength, refracts by Sellmeier dispersion and
 * is traced through all of its bounces on the GPU. The renderer is Tantalum by
 * Benedikt Bitterli (public/tantalum, zlib license), modified to trace complete light
 * paths each frame so the beam appears at once instead of building up.
 *
 * Drag the prism to move it (any pointer, touch included). Drag anywhere else with a
 * mouse or pen, or swipe sideways on a touch screen, to move the light; it stays aimed
 * at the prism. Vertical swipes still scroll the page. Double-click resets both.
 */

const BASE = "/tantalum/";
const HINT_KEY = "prism-drag-hint-dismissed";
const SCRIPTS = ["spectrum.js", "tantalum-shaders.js", "tantalum-gl.js", "tantalum-core.js"];

/* Scene: absorbing walls at the screen edge and one rotatable glass prism. */
const HERO_SCENE = `#include "trace-frag"

#include "bsdf"
#include "intersect"

uniform vec2 Bounds;
uniform vec2 PrismA;
uniform vec2 PrismB;
uniform vec2 PrismC;

void intersect(Ray ray, inout Intersection isect) {
    bboxIntersect(ray, vec2(0.0), Bounds, 0.0, isect);
    lineIntersect(ray, PrismA, PrismB, 1.0, isect);
    lineIntersect(ray, PrismB, PrismC, 1.0, isect);
    lineIntersect(ray, PrismC, PrismA, 1.0, isect);
}

vec2 sample(inout vec4 state, Intersection isect, float lambda, vec2 wiLocal, inout vec3 throughput) {
    if (isect.mat == 1.0) {
        float ior = sellmeierIor(vec3(1.6215, 0.2563, 1.6445), vec3(0.0122, 0.0596, 17.4688), lambda)/1.8;
        // Slightly rough glass; low enough that few rays stray into faint streaks.
        return sampleRoughDielectric(state, wiLocal, 0.05, ior);
    }
    throughput = vec3(0.0);
    return sampleDiffuse(state, wiLocal);
}
`;

/*
 * Final composite. While only a few thousand light paths have landed, individual rays
 * show as streaks; a small disc blur (radius from JS, shrinking as samples accumulate)
 * turns them into a smooth glow that sharpens as the image converges. Then a soft
 * shoulder tone map so the beam core goes white without a hard clip.
 */
const COMPOSE_FRAG = `#include "preamble"

uniform sampler2D Frame;
uniform float Exposure;
uniform vec2 Blur;

varying vec2 vTexCoord;

void main() {
    vec3 sum = texture2D(Frame, vTexCoord).rgb;
    float wsum = 1.0;
    for (int i = 0; i < 12; i++) {
        float fi = float(i);
        float r = sqrt((fi + 0.5)/12.0);
        float a = fi*2.39996323;
        float w = 1.0 - 0.6*r;
        sum += texture2D(Frame, vTexCoord + vec2(cos(a), sin(a))*r*Blur).rgb*w;
        wsum += w;
    }
    vec3 c = sum/wsum*Exposure;
    gl_FragColor = vec4(pow(vec3(1.0) - exp(-c), vec3(1.0/2.2)), 1.0);
}
`;

/* ---------- Layout, in Tantalum scene units: x in [-aspect, aspect], y in [-1, 1] ---------- */

type V = [number, number];

type Layout = {
  center: V;
  radius: number;
  /** Rotation of prism and beam together, radians (counter-clockwise). */
  turn: number;
};

// Tantalum's own prism scene: apex up, beam rising ~25° into the left face,
// spectrum leaving down and to the right. We keep that geometry and turn it.
const BEAM_RISE = (25 * Math.PI) / 180;
const ENTRY = 0.55; // how far down the left face the beam lands, apex = 0

function layoutFor(aspect: number): Layout {
  if (aspect >= 1) {
    // Keep the full rotating volume in the open area to the right of the headline.
    return { center: [aspect * 0.75, 0.3], radius: Math.min(0.32, aspect * 0.17), turn: (-30 * Math.PI) / 180 };
  }
  return { center: [aspect * 0.12, 0.5], radius: Math.min(0.18, aspect * 0.3), turn: (-30 * Math.PI) / 180 };
}

const rot = ([x, y]: V, a: number): V => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];

function prismVertices({ center, radius, turn }: Layout): [V, V, V] {
  // Clockwise, so lineIntersect's normals face outward.
  const base: V[] = [
    [0, 1],
    [0.866, -0.5],
    [-0.866, -0.5],
  ];
  return base.map((p) => add(center, rot([p[0] * radius, p[1] * radius], turn))) as [V, V, V];
}

/** Point on the prism's left face where the beam lands. */
function entryPoint(l: Layout): V {
  const [a, , c] = prismVertices(l);
  return [a[0] + (c[0] - a[0]) * ENTRY, a[1] + (c[1] - a[1]) * ENTRY];
}

/** Default light position: off the left edge, on the beam's line into the prism. */
function defaultSource(l: Layout, aspect: number): V {
  const t = entryPoint(l);
  const dir = rot([Math.cos(BEAM_RISE), Math.sin(BEAM_RISE)], l.turn);
  // Follow the rotating prism from whichever edge of the scene is upstream.
  const kx = dir[0] > 0 ? (t[0] + aspect * 0.995) / dir[0] : dir[0] < 0 ? (t[0] - aspect * 0.995) / dir[0] : Infinity;
  const ky = dir[1] > 0 ? (t[1] + 0.995) / dir[1] : dir[1] < 0 ? (t[1] - 0.995) / dir[1] : Infinity;
  const k = Math.min(kx, ky);
  return [t[0] - dir[0] * k, t[1] - dir[1] * k];
}

/* ---------- Tantalum glue ---------- */

type Shader = { uniform2F: (n: string, a: number, b: number) => void };
type Renderer = {
  setSpreadType: (t: number) => void;
  setEmitterPos: (a: V, b: V) => void;
  setMaxSampleCount: (n: number) => void;
  setMaxPathLength: (n: number) => void;
  onComposeUniforms?: (s: Shader) => void;
  samplesTraced: number;
  changeResolution: (w: number, h: number) => void;
  renderInstant: (t: number) => void;
  finished: () => boolean;
  idle: () => void;
  reset: () => void;
  onTraceUniforms?: (s: Shader) => void;
  spatialSpread: number;
  activeBlock: number;
  maxActiveBlock: number;
  emitterPower: number;
  needsReset: boolean;
};

type TantalumGlobals = {
  Shaders: Record<string, string>;
  tgl: { init: (gl: WebGLRenderingContext, ext: unknown) => void };
  tcore: { Renderer: (new (gl: WebGLRenderingContext, w: number, h: number, scenes: string[]) => Renderer) & { SPREAD_LASER: number } };
};

let loading: Promise<void> | null = null;
function loadTantalum() {
  if (loading) return loading;
  loading = SCRIPTS.reduce<Promise<void>>(
    (chain, src) =>
      chain.then(
        () =>
          new Promise<void>((resolve, reject) => {
            const el = document.createElement("script");
            el.src = BASE + src;
            el.async = false;
            el.onload = () => resolve();
            el.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(el);
          }),
      ),
    Promise.resolve(),
  );
  loading.catch(() => (loading = null));
  return loading;
}

// Light paths per image. The hero is soft light, so a modest count converges cleanly
// in a few frames, after which the renderer stops and costs nothing.
const SAMPLES = 400_000;
/** Ray-texture rows traced per frame (512 rays each), idle vs. while dragging. */
const ROWS_SETTLING = 48;
const ROWS_DRAGGING = 24;
/** Keep the animated prism responsive without retracing at the monitor refresh rate. */
const AUTO_FRAME_MS = 70;
/** One unhurried turn every 42 seconds. */
const AUTO_ROTATION_SPEED = (Math.PI * 2) / 42;
/** A white beam through one prism needs ~4 bounces; 6 leaves room for internal reflections. */
const BOUNCES = 6;
/** Denoise blur radius in CSS px after the first frame of rays; shrinks with 1/sqrt(samples). */
const BLUR_START_PX = 9;
const BEAM_WIDTH = 0.03; // scene units, full width of the beam's soft profile
/** Peak brightness of the incoming beam before tone mapping (1 = white). */
const BEAM_PEAK = 3;

export default function PrismScene({ active, reduced, onReady }: { active: boolean; reduced: boolean; onReady?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outlineRef = useRef<SVGPolygonElement>(null);
  const backFaceRef = useRef<SVGPolygonElement>(null);
  const sideABRef = useRef<SVGPolygonElement>(null);
  const sideBCRef = useRef<SVGPolygonElement>(null);
  const sideCARef = useRef<SVGPolygonElement>(null);
  const frontFaceRef = useRef<SVGPolygonElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const reducedRef = useRef(reduced);
  const wake = useRef<() => void>(() => {});
  const readyRef = useRef(onReady);

  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    activeRef.current = active;
    if (active) wake.current();
  }, [active]);

  useEffect(() => {
    reducedRef.current = reduced;
    wake.current();
  }, [reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let frame = 0;
    let cleanupInput = () => {};

    loadTantalum()
      .then(() => {
        if (cancelled) return;
        const g = window as unknown as TantalumGlobals;
        const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
        if (!gl) throw new Error("WebGL unavailable");
        const floatExt = gl.getExtension("OES_texture_float");
        const floatLin = gl.getExtension("OES_texture_float_linear");
        const drawBuffers = gl.getExtension("WEBGL_draw_buffers");
        gl.getExtension("WEBGL_color_buffer_float");
        if (!floatExt || !floatLin || !drawBuffers) throw new Error("Float render targets unavailable");

        g.Shaders["scene-hero"] = HERO_SCENE;
        // Soft-edged beam: triangular spatial profile instead of a flat bar.
        g.Shaders["init-frag"] = g.Shaders["init-frag"].replace(
          "(rand(state) - 0.5)*SpatialSpread",
          "(rand(state) + rand(state) - 1.0)*0.5*SpatialSpread",
        );
        g.Shaders["compose-frag"] = COMPOSE_FRAG;
        g.tgl.init(gl, drawBuffers);

        const size = () => {
          const r = canvas.getBoundingClientRect();
          // Render at CSS-pixel size (no devicePixelRatio) and at most 1280 wide:
          // diffuse light upsamples invisibly and fill cost drops 2-4x.
          const scale = Math.min(1, 1280 / Math.max(r.width, 1));
          return [Math.max(2, Math.round(r.width * scale)), Math.max(2, Math.round(r.height * scale))] as const;
        };

        let [w, h] = size();
        canvas.width = w;
        canvas.height = h;
        const renderer = new g.tcore.Renderer(gl, w, h, ["scene-hero"]);
        renderer.setMaxSampleCount(SAMPLES);
        // Small ray batches: each frame stays cheap, the beam still appears at once.
        renderer.setMaxPathLength(BOUNCES);
        renderer.activeBlock = ROWS_SETTLING;
        renderer.maxActiveBlock = ROWS_SETTLING;
        renderer.setSpreadType(g.tcore.Renderer.SPREAD_LASER);

        let aspect = w / h;
        let prismAt: V | null = null; // where the visitor dragged the prism, if anywhere
        let autoTurn = 0;
        let pointerOverPrism = false;
        let pointerClient: V | null = null;
        let lastAutoFrame = 0;
        type Gesture = { id: number; mode: "prism" | "light" | "pending"; x: number; y: number; offset: V };
        let gesture: Gesture | null = null;
        const clampCenter = ([x, y]: V, radius: number): V => [
          Math.min(aspect - radius, Math.max(-aspect + radius, x)),
          Math.min(1 - radius, Math.max(-1 + radius, y)),
        ];
        const layoutNow = (): Layout => {
          const base = layoutFor(aspect);
          return {
            ...base,
            center: clampCenter(prismAt ?? base.center, base.radius * 1.46),
            turn: base.turn + autoTurn,
          };
        };
        let layout = layoutNow();
        let source: V = defaultSource(layout, aspect);
        let custom = false;

        const toPixels = ([x, y]: V): V => [((x / aspect + 1) / 2) * w, ((1 - y) / 2) * h];
        const toScene = (px: number, py: number): V => [((px / w) * 2 - 1) * aspect, 1 - (py / h) * 2];
        const scenePoint = (e: PointerEvent): V => {
          const r = canvas.getBoundingClientRect();
          return toScene(((e.clientX - r.left) / r.width) * w, ((e.clientY - r.top) / r.height) * h);
        };
        const hoverAt = (p: V) => {
          const [cx, cy] = layout.center;
          pointerOverPrism = Math.hypot(p[0] - cx, p[1] - cy) < layout.radius * 1.2;
        };

        const drawOutline = () => {
          const svg = svgRef.current;
          const poly = outlineRef.current;
          if (!svg || !poly) return;
          svg.setAttribute("viewBox", `${-aspect} -1 ${aspect * 2} 2`);
          const [a, b, c] = prismVertices(layout);
          const depth = rot([layout.radius * 0.36, layout.radius * 0.2], layout.turn);
          const [backA, backB, backC] = [add(a, depth), add(b, depth), add(c, depth)];
          const asPoints = (points: V[]) => points.map(([x, y]) => `${x},${-y}`).join(" ");
          backFaceRef.current?.setAttribute("points", asPoints([backA, backB, backC]));
          sideABRef.current?.setAttribute("points", asPoints([a, b, backB, backA]));
          sideBCRef.current?.setAttribute("points", asPoints([b, c, backC, backB]));
          sideCARef.current?.setAttribute("points", asPoints([c, a, backA, backC]));
          frontFaceRef.current?.setAttribute("points", asPoints([a, b, c]));
          poly.setAttribute("points", asPoints([a, b, c]));
          placeHandle();
          placeHint();
        };

        // A touch target over the prism. It opts out of browser panning so a finger on the
        // prism drags it, while the rest of the hero keeps scrolling normally.
        const placeHandle = () => {
          const handle = handleRef.current;
          if (!handle) return;
          const [cx, cy] = layout.center;
          const sizePx = layout.radius * 1.6 * (canvas.clientHeight / 2);
          handle.style.left = `${((cx / aspect + 1) / 2) * 100}%`;
          handle.style.top = `${((1 - cy) / 2) * 100}%`;
          handle.style.width = handle.style.height = `${Math.max(56, sizePx)}px`;
        };

        // Hint sits just under the beam, partway between the light and the prism.
        const placeHint = () => {
          const hint = hintRef.current;
          if (!hint) return;
          const t = entryPoint(layout);
          const k = aspect >= 1 ? 0.62 : 0.5;
          const x = source[0] + (t[0] - source[0]) * k;
          const y = source[1] + (t[1] - source[1]) * k;
          hint.style.left = `${((x / aspect + 1) / 2) * 100}%`;
          hint.style.top = `calc(${((1 - y) / 2) * 100}% + 22px)`;
        };

        let hintDismissed = false;
        try {
          hintDismissed = localStorage.getItem(HINT_KEY) === "1";
        } catch {
          /* storage blocked: show the hint for this visit */
        }
        const showHint = () => {
          if (!hintDismissed) hintRef.current?.setAttribute("data-show", "");
        };
        const dismissHint = () => {
          if (hintDismissed) return;
          hintDismissed = true;
          hintRef.current?.setAttribute("data-gone", "");
          try {
            localStorage.setItem(HINT_KEY, "1");
          } catch {
            /* fine: it just reappears next visit */
          }
        };

        const aim = () => {
          renderer.needsReset = true;
          renderer.setEmitterPos(toPixels(source), toPixels(entryPoint(layout)));
          // A narrow beam rather than a 1px laser line, so the spectrum reads as a band.
          renderer.spatialSpread = BEAM_WIDTH;
          // Tantalum's exposure scales with canvas width; divide that out so the beam
          // looks the same at every screen size. Peak density of a triangular profile
          // is twice the mean, and BEAM_WIDTH spans h/2 pixels per scene unit.
          renderer.emitterPower = (BEAM_PEAK * 0.5 * BEAM_WIDTH * (h / 2)) / w;
        };

        // Blur fades from BLUR_START_PX to nothing as samples accumulate.
        const firstFrameSamples = 512 * ROWS_DRAGGING;
        renderer.onComposeUniforms = (s) => {
          const samples = Math.max(renderer.samplesTraced, 1);
          const cssToPx = w / Math.max(canvas.clientWidth, 1);
          const px = Math.max(0, BLUR_START_PX * Math.sqrt(firstFrameSamples / samples) - 0.75) * cssToPx;
          s.uniform2F("Blur", px / w, px / h);
        };

        renderer.onTraceUniforms = (s) => {
          const [a, b, c] = prismVertices(layout);
          s.uniform2F("Bounds", aspect + 0.02, 1.02);
          s.uniform2F("PrismA", a[0], a[1]);
          s.uniform2F("PrismB", b[0], b[1]);
          s.uniform2F("PrismC", c[0], c[1]);
        };

        aim();
        drawOutline();

        let announced = false;
        const loop = (t: number) => {
          frame = 0;
          if (cancelled || !activeRef.current) return;
          if (pointerClient && !gesture) hoverAt(toScene(
            ((pointerClient[0] - canvas.getBoundingClientRect().left) / canvas.clientWidth) * w,
            ((pointerClient[1] - canvas.getBoundingClientRect().top) / canvas.clientHeight) * h,
          ));
          const rotating = !reducedRef.current && !pointerOverPrism && !gesture;
          const rotateFrame = rotating && (!lastAutoFrame || t - lastAutoFrame >= AUTO_FRAME_MS);
          if (rotateFrame) {
            const elapsed = lastAutoFrame ? Math.min((t - lastAutoFrame) / 1000, 0.2) : AUTO_FRAME_MS / 1000;
            lastAutoFrame = t;
            autoTurn = (autoTurn + elapsed * AUTO_ROTATION_SPEED) % (Math.PI * 2);
            layout = layoutNow();
            if (!custom) source = defaultSource(layout, aspect);
            drawOutline();
            aim();
          }
          if (rotateFrame || (!rotating && !renderer.finished())) {
            renderer.renderInstant(t);
            if (!announced) {
              announced = true;
              readyRef.current?.();
              showHint();
            }
          }
          if (rotating || !renderer.finished()) {
            frame = requestAnimationFrame(loop);
          } else {
            renderer.idle();
          }
        };
        wake.current = () => {
          if (!frame && !cancelled && activeRef.current) frame = requestAnimationFrame(loop);
        };
        wake.current();

        // Resize: new pixel grid, same scene.
        let resizeTimer = 0;
        const ro = new ResizeObserver(() => {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(() => {
            const [nw, nh] = size();
            if (nw === w && nh === h) return;
            w = nw;
            h = nh;
            canvas.width = w;
            canvas.height = h;
            aspect = w / h;
            layout = layoutNow();
            if (!custom) source = defaultSource(layout, aspect);
            renderer.changeResolution(w, h);
            aim();
            drawOutline();
            wake.current();
          }, 120);
        });
        ro.observe(canvas);

        // Input. One gesture at a time: "prism" moves the prism, "light" moves the light,
        // "pending" is a touch on the open hero that becomes a light drag only if it heads
        // sideways (vertical swipes belong to the browser and end in pointercancel).
        const handle = handleRef.current;

        const trackHover = (e: PointerEvent) => {
          if (e.pointerType === "touch") return;
          pointerClient = [e.clientX, e.clientY];
          if (gesture) return;
          const wasOver = pointerOverPrism;
          hoverAt(scenePoint(e));
          if (!pointerOverPrism && wasOver) {
            lastAutoFrame = 0;
            wake.current();
          }
        };
        const leavePrism = (e: PointerEvent) => {
          if (e.pointerType === "touch" || gesture) return;
          pointerClient = null;
          if (!pointerOverPrism) return;
          pointerOverPrism = false;
          pointerClient = null;
          lastAutoFrame = 0;
          wake.current();
        };
        const startDragging = () => {
          renderer.maxActiveBlock = ROWS_DRAGGING;
          renderer.activeBlock = Math.min(renderer.activeBlock, ROWS_DRAGGING);
          dismissHint();
        };
        const apply = (e: PointerEvent) => {
          if (!gesture) return;
          const p = scenePoint(e);
          if (gesture.mode === "prism") {
            prismAt = [p[0] + gesture.offset[0], p[1] + gesture.offset[1]];
            layout = layoutNow();
            if (!custom) source = defaultSource(layout, aspect);
            drawOutline();
          } else {
            source = p;
            custom = true;
          }
          aim();
          wake.current();
        };
        const begin = (e: PointerEvent, onPrism: boolean) => {
          if (e.pointerType !== "touch" && e.button !== 0) return;
          if (gesture) return;
          const p = scenePoint(e);
          const touchOpen = e.pointerType === "touch" && !onPrism;
          gesture = {
            id: e.pointerId,
            mode: onPrism ? "prism" : touchOpen ? "pending" : "light",
            x: e.clientX,
            y: e.clientY,
            offset: [layout.center[0] - p[0], layout.center[1] - p[1]],
          };
          if (onPrism) pointerOverPrism = true;
          if (e.pointerType !== "touch") pointerClient = [e.clientX, e.clientY];
          if (gesture.mode === "pending") return;
          if (onPrism) e.preventDefault();
          startDragging();
          try {
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
          } catch {
            /* synthetic or already-released pointer */
          }
          if (gesture.mode === "light") apply(e);
          handle?.setAttribute("data-dragging", "");
        };
        const onMove = (e: PointerEvent) => {
          if (!gesture || e.pointerId !== gesture.id) return;
          if (gesture.mode === "pending") {
            const dx = Math.abs(e.clientX - gesture.x);
            const dy = Math.abs(e.clientY - gesture.y);
            if (dx < 10 || dx < dy * 1.2) return;
            gesture.mode = "light";
            startDragging();
          }
          apply(e);
        };
        const end = (e: PointerEvent) => {
          if (!gesture || e.pointerId !== gesture.id) return;
          gesture = null;
          renderer.maxActiveBlock = ROWS_SETTLING;
          handle?.removeAttribute("data-dragging");
          if (e.pointerType !== "touch") {
            trackHover(e);
          } else {
            pointerOverPrism = false;
            lastAutoFrame = 0;
            wake.current();
          }
        };
        const reset = () => {
          custom = false;
          prismAt = null;
          autoTurn = 0;
          lastAutoFrame = 0;
          layout = layoutNow();
          source = defaultSource(layout, aspect);
          drawOutline();
          aim();
          wake.current();
        };
        const downCanvas = (e: PointerEvent) => {
          // A mouse on the prism moves the prism too, not only a finger on the handle.
          const p = scenePoint(e);
          const [cx, cy] = layout.center;
          begin(e, Math.hypot(p[0] - cx, p[1] - cy) < layout.radius * 0.8);
        };
        const downHandle = (e: PointerEvent) => begin(e, true);

        const targets: HTMLElement[] = handle ? [canvas, handle] : [canvas];
        canvas.addEventListener("pointerdown", downCanvas);
        canvas.addEventListener("pointermove", trackHover);
        canvas.addEventListener("pointerleave", leavePrism);
        handle?.addEventListener("pointerdown", downHandle);
        handle?.addEventListener("pointermove", trackHover);
        handle?.addEventListener("pointerleave", leavePrism);
        for (const t of targets) {
          t.addEventListener("pointermove", onMove);
          t.addEventListener("pointerup", end);
          t.addEventListener("pointercancel", end);
          t.addEventListener("dblclick", reset);
        }
        cleanupInput = () => {
          ro.disconnect();
          window.clearTimeout(resizeTimer);
          canvas.removeEventListener("pointerdown", downCanvas);
          canvas.removeEventListener("pointermove", trackHover);
          canvas.removeEventListener("pointerleave", leavePrism);
          handle?.removeEventListener("pointerdown", downHandle);
          handle?.removeEventListener("pointermove", trackHover);
          handle?.removeEventListener("pointerleave", leavePrism);
          for (const t of targets) {
            t.removeEventListener("pointermove", onMove);
            t.removeEventListener("pointerup", end);
            t.removeEventListener("pointercancel", end);
            t.removeEventListener("dblclick", reset);
          }
        };
      })
      .catch((err) => {
        // No float WebGL: the outline alone still shows a prism, and the copy carries the page.
        console.warn("Prism hero renderer unavailable:", err);
        readyRef.current?.();
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      cleanupInput();
      wake.current = () => {};
    };
  }, []);

  return (
    <>
      <div ref={hintRef} className={styles.hint} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            d="M8 1.8v12.4M1.8 8h12.4M8 1.8 6.2 3.6M8 1.8l1.8 1.8M8 14.2l-1.8-1.8M8 14.2l1.8-1.8M1.8 8l1.8-1.8M1.8 8l1.8 1.8M14.2 8l-1.8-1.8M14.2 8l-1.8 1.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Drag the prism or the light
      </div>
      <div ref={handleRef} className={styles.handle} aria-hidden="true" />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", cursor: "crosshair", touchAction: "pan-y" }}
      />
      <svg
        ref={svgRef}
        aria-hidden="true"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <defs>
          <linearGradient id="prism-front-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eaf7ff" stopOpacity="0.16" />
            <stop offset="52%" stopColor="#9ecbff" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#ac8cff" stopOpacity="0.13" />
          </linearGradient>
          <linearGradient id="prism-side-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#91e7ff" stopOpacity="0.19" />
            <stop offset="100%" stopColor="#8673ff" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <polygon ref={backFaceRef} className={styles.prismBack} />
        <polygon ref={sideABRef} className={styles.prismSideA} />
        <polygon ref={sideBCRef} className={styles.prismSideB} />
        <polygon ref={sideCARef} className={styles.prismSideC} />
        <polygon ref={frontFaceRef} className={styles.prismFront} />
        <polygon
          ref={outlineRef}
          className={styles.prismOutline}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </>
  );
}
