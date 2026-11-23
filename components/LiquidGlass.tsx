"use client";

import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import styles from "./LiquidGlass.module.css";
import { useBackdropUrlSupport, useReducedTransparency } from "@/lib/useMedia";

/**
 * Liquid Glass for the web.
 *
 * Apple's material is defined by lensing: the rim of a glass control bends whatever
 * sits behind it. We approximate that with an SVG displacement filter applied as a
 * backdrop-filter. The displacement map is generated per element size: neutral gray
 * (no shift) across the flat middle, and a vector pointing back toward the centre in
 * a band along the edge, strongest at the very rim — the profile of a convex bezel.
 *
 * Only Chromium supports url() inside backdrop-filter. Every other engine gets a
 * frosted blur with the same specular rim, which still reads as glass.
 */

type Props = {
  as?: ElementType;
  tone?: "dark" | "light";
  /** Corner radius in px. Omit for a pill. */
  radius?: number;
  /** Width of the refracting rim in px. */
  bezel?: number;
  /** Maximum displacement in px. */
  strength?: number;
  /** Frost applied before refraction. 0 keeps what's underneath sharp. */
  blur?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  interactive?: boolean;
} & Record<string, unknown>;

function buildDisplacementMap(w: number, h: number, r: number, bezel: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const cx = w / 2;
  const cy = h / 2;
  const hx = w / 2 - r;
  const hy = h / 2 - r;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      const qx = Math.abs(px) - hx;
      const qy = Math.abs(py) - hy;
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      // Signed distance to the rounded-rect edge (negative inside).
      const sdf = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
      const inside = -sdf;

      let nx = 0;
      let ny = 0;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy) || 1;
        nx = (qx / len) * Math.sign(px);
        ny = (qy / len) * Math.sign(py);
      } else if (qx > qy) {
        nx = Math.sign(px);
      } else {
        ny = Math.sign(py);
      }

      let mag = 0;
      if (inside >= 0 && inside < bezel) {
        const t = 1 - inside / bezel; // 1 at the rim, 0 where the flat face begins
        mag = t * t * (3 - 2 * t); // smooth convex falloff
      }

      const i = (y * w + x) * 4;
      // Sample inward (against the outward normal) so the rim magnifies the backdrop.
      d[i] = Math.round(127.5 - nx * mag * 127.5);
      d[i + 1] = Math.round(127.5 - ny * mag * 127.5);
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

export default function LiquidGlass({
  as: Tag = "div",
  tone = "dark",
  radius,
  bezel = 14,
  strength = 38,
  blur,
  className,
  style,
  children,
  interactive = false,
  ...rest
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const rawId = useId();
  const filterId = `lg-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const canLens = useBackdropUrlSupport();
  const reduceTransparency = useReducedTransparency();
  const lensing = canLens && !reduceTransparency;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      const w = Math.round(box ? box.inlineSize : el.offsetWidth);
      const h = Math.round(box ? box.blockSize : el.offsetHeight);
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const map = useMemo(() => {
    if (!lensing || !size || size.w < 2 || size.h < 2) return null;
    const r = Math.min(radius ?? size.h / 2, size.w / 2, size.h / 2);
    const b = Math.min(bezel, size.h / 2, size.w / 2);
    return buildDisplacementMap(size.w, size.h, r, b);
  }, [lensing, size, radius, bezel]);

  const onPointerMove = interactive
    ? (e: React.PointerEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
      }
    : undefined;

  const active = lensing && map && size;
  const merged: CSSProperties = {
    ...style,
    borderRadius: radius ?? 999,
    ...(active
      ? { backdropFilter: `url(#${filterId})`, WebkitBackdropFilter: `url(#${filterId})` }
      : null),
  };

  return (
    <Tag
      ref={ref}
      className={[styles.glass, styles[tone], interactive && styles.interactive, className]
        .filter(Boolean)
        .join(" ")}
      style={merged}
      onPointerMove={onPointerMove}
      data-lensing={active ? "" : undefined}
      {...rest}
    >
      {active && (
        <svg className={styles.defs} aria-hidden="true" focusable="false">
          <filter
            id={filterId}
            x="0"
            y="0"
            width={size.w}
            height={size.h}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur ?? (tone === "dark" ? 2.2 : 3)} result="soft" />
            <feImage href={map} x="0" y="0" width={size.w} height={size.h} result="map" preserveAspectRatio="none" />
            <feDisplacementMap in="soft" in2="map" scale={strength} xChannelSelector="R" yChannelSelector="G" result="bent" />
            <feColorMatrix in="bent" type="saturate" values={tone === "dark" ? "1.6" : "1.35"} />
          </filter>
        </svg>
      )}
      <span className={styles.content}>{children}</span>
    </Tag>
  );
}
