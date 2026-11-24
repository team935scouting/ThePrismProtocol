"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Announcement from "./Announcement";
import LiquidGlass from "./LiquidGlass";
import styles from "./Hero.module.css";
import { useReducedMotion } from "@/lib/useMedia";

const PrismScene = dynamic(() => import("./PrismScene"), { ssr: false });

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className={styles.hero} data-nav="dark" id="top">
      <div className={styles.stage} data-ready={ready ? "" : undefined}>
        <PrismScene active={visible} reduced={reduced} onReady={() => setReady(true)} />
      </div>
      <div className={styles.scrim} aria-hidden="true" />

      <div className={`wrap ${styles.copy}`}>
        <Announcement />
        <p className={styles.eyebrow}>The Prism Protocol</p>
        <h1 className={styles.title}>
          Scouting data
          <br />
          that works across apps.
        </h1>
        <p className={styles.lede}>
          The Prism Protocol (TPP) gives scouting software a shared way to describe, check and
          convert match data. Keep the system you use today, and add TPP where you want records
          to move between apps.
        </p>
        <div className={styles.actions}>
          <a href="#protocol" className={styles.primary}>
            What TPP is
          </a>
          <LiquidGlass as="a" href="#how" tone="dark" interactive className={styles.secondary}>
            See it work
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 2v10M3 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </LiquidGlass>
        </div>
      </div>
    </section>
  );
}
