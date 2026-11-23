"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import LiquidGlass from "./LiquidGlass";
import styles from "./Hero.module.css";
import { useReducedMotion } from "@/lib/useMedia";
import type { PrismControls } from "./PrismScene";

const PrismScene = dynamic(() => import("./PrismScene"), { ssr: false });

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const controls = useRef<PrismControls>({ drag: 0, scroll: 0 });
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);

    // Scrolling through the hero turns the prism, so touch screens see the light move too.
    const onScroll = () => {
      controls.current.scroll = Math.min(1, window.scrollY / el.offsetHeight);
    };

    // Drag anywhere in the hero to spin it. Horizontal only, so vertical swipes still scroll.
    let down: { x: number; start: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("a, button")) return;
      down = { x: e.clientX, start: controls.current.drag };
      el.setPointerCapture(e.pointerId);
      el.dataset.dragging = "";
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = (e.clientX - down.x) / Math.max(320, el.clientWidth);
      controls.current.drag = Math.max(-1.6, Math.min(1.6, down.start - dx * 3.2));
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      down = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      delete el.dataset.dragging;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <section ref={ref} className={styles.hero} data-nav="dark" id="top">
      <div className={styles.stage} data-ready={ready ? "" : undefined}>
        <PrismScene active={visible} reduced={reduced} controls={controls} onReady={() => setReady(true)} />
      </div>
      <div className={styles.scrim} aria-hidden="true" />

      <div className={`wrap ${styles.copy}`}>
        <p className={styles.eyebrow}>The Prism Protocol</p>
        <h1 className={styles.title}>
          Six scouts in.
          <br />
          One stream out.
        </h1>
        <p className={styles.lede}>
          Prism is a Raspberry Pi that handles Bluetooth for every phone and tablet in the
          stands, then hands your scouting app clean JSON over the local network.
        </p>
        <div className={styles.actions}>
          <a href="#download" className={styles.primary}>
            Get Prism OS
          </a>
          <LiquidGlass as="a" href="#how" tone="dark" interactive className={styles.secondary}>
            See how it works
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 2v10M3 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </LiquidGlass>
        </div>
      </div>
      <p className={styles.hint} aria-hidden="true">
        Drag to turn the prism
      </p>
    </section>
  );
}
