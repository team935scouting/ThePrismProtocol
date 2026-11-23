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
 * Drag across the hero (mouse or pen) to move the light; it stays aimed at the prism.
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
        return sampleRoughDielectric(state, wiLocal, 0.1, ior);
    }
    throughput = vec3(0.0);
    return sampleDiffuse(state, wiLocal);
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
    // Clear of the headline, which sits bottom-left.
    return { center: [aspect * 0.3, 0.3], radius: Math.min(0.46, 0.2 + aspect * 0.14), turn: (-30 * Math.PI) / 180 };
  }
  return { center: [aspect * 0.12, 0.5], radius: Math.min(0.3, aspect * 0.62), turn: (-30 * Math.PI) / 180 };
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
  const k = (t[0] + aspect * 0.995) / dir[0];
  return [t[0] - dir[0] * k, t[1] - dir[1] * k];
}

/* ---------- Tantalum glue ---------- */

type Shader = { uniform2F: (n: string, a: number, b: number) => void };
type Renderer = {
  setSpreadType: (t: number) => void;
  setEmitterPos: (a: V, b: V) => void;
  setMaxSampleCount: (n: number) => void;
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
const BEAM_WIDTH = 0.03; // scene units, full width of the beam's soft profile
/** Peak brightness of the incoming beam before tone mapping (1 = white). */
const BEAM_PEAK = 3;

export default function PrismScene({ active, onReady }: { active: boolean; reduced: boolean; onReady?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outlineRef = useRef<SVGPolygonElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
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
        // Soft shoulder tone map so the beam core goes white without a hard clip.
        g.Shaders["compose-frag"] = g.Shaders["compose-frag"].replace(
          "pow(texture2D(Frame, vTexCoord).rgb*Exposure, vec3(1.0/2.2))",
          "pow(vec3(1.0) - exp(-texture2D(Frame, vTexCoord).rgb*Exposure), vec3(1.0/2.2))",
        );
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
        renderer.activeBlock = 64;
        renderer.maxActiveBlock = 64; // at most ~32k light paths per frame
        renderer.setSpreadType(g.tcore.Renderer.SPREAD_LASER);

        let aspect = w / h;
        let layout = layoutFor(aspect);
        let source: V = defaultSource(layout, aspect);
        let custom = false;

        const toPixels = ([x, y]: V): V => [((x / aspect + 1) / 2) * w, ((1 - y) / 2) * h];
        const toScene = (px: number, py: number): V => [((px / w) * 2 - 1) * aspect, 1 - (py / h) * 2];

        const drawOutline = () => {
          const svg = svgRef.current;
          const poly = outlineRef.current;
          if (!svg || !poly) return;
          svg.setAttribute("viewBox", `${-aspect} -1 ${aspect * 2} 2`);
          poly.setAttribute("points", prismVertices(layout).map(([x, y]) => `${x},${-y}`).join(" "));
          placeHint();
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
        const canDrag = window.matchMedia("(any-pointer: fine)").matches;
        const showHint = () => {
          if (!hintDismissed && canDrag) hintRef.current?.setAttribute("data-show", "");
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
          if (!renderer.finished()) {
            renderer.renderInstant(t);
            if (!announced) {
              announced = true;
              readyRef.current?.();
              showHint();
            }
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
            layout = layoutFor(aspect);
            if (!custom) source = defaultSource(layout, aspect);
            renderer.changeResolution(w, h);
            aim();
            drawOutline();
            wake.current();
          }, 120);
        });
        ro.observe(canvas);

        // Drag to move the light. Touch is left alone so the page still scrolls.
        let dragging = false;
        const move = (e: PointerEvent) => {
          const r = canvas.getBoundingClientRect();
          source = toScene(((e.clientX - r.left) / r.width) * w, ((e.clientY - r.top) / r.height) * h);
          custom = true;
          aim();
          wake.current();
        };
        const down = (e: PointerEvent) => {
          if (e.pointerType === "touch" || e.button !== 0) return;
          dragging = true;
          dismissHint();
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {
            /* synthetic or already-released pointer */
          }
          move(e);
        };
        const drag = (e: PointerEvent) => dragging && move(e);
        const up = () => (dragging = false);
        const reset = () => {
          custom = false;
          source = defaultSource(layout, aspect);
          aim();
          wake.current();
        };
        canvas.addEventListener("pointerdown", down);
        canvas.addEventListener("pointermove", drag);
        canvas.addEventListener("pointerup", up);
        canvas.addEventListener("pointercancel", up);
        canvas.addEventListener("dblclick", reset);
        cleanupInput = () => {
          ro.disconnect();
          window.clearTimeout(resizeTimer);
          canvas.removeEventListener("pointerdown", down);
          canvas.removeEventListener("pointermove", drag);
          canvas.removeEventListener("pointerup", up);
          canvas.removeEventListener("pointercancel", up);
          canvas.removeEventListener("dblclick", reset);
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
        Drag to move the light
      </div>
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
        <polygon
          ref={outlineRef}
          fill="none"
          stroke="rgba(245,245,247,0.22)"
          strokeWidth={1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </>
  );
}
