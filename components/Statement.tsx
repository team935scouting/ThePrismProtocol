"use client";

import { useEffect, useRef } from "react";
import styles from "./Statement.module.css";

const LINE =
  "Every scouting app saves match data in its own shape. TPP gives those records a shared structure, so teams can exchange scouting data without replacing the apps they already use.";

/** Words light up as the paragraph passes through the reading line. */
export default function Statement() {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = LINE.split(" ");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLSpanElement>("span"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      spans.forEach((s) => (s.style.opacity = "1"));
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the top hits 85% of the viewport, 1 when the bottom reaches 45%.
      const start = vh * 0.85;
      const end = vh * 0.45;
      const total = start - end + r.height;
      const p = Math.min(1, Math.max(0, (start - r.top) / total));
      const lit = p * spans.length;
      spans.forEach((s, i) => {
        const o = Math.min(1, Math.max(0, lit - i));
        s.style.opacity = String(0.16 + o * 0.84);
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className={styles.section} data-nav="light" id="protocol">
      <div className="wrap">
        <p className={`eyebrow ${styles.eyebrow}`}>What TPP is</p>
        <p ref={ref} className={styles.line}>
          {words.map((w, i) => (
            <span key={i}>{w} </span>
          ))}
        </p>

        <div className={styles.layers}>
          <p className="lead">
            <strong>A shared structure.</strong> Define scouting metrics and their types once.
            TPP carries those definitions with the match records that use them.
          </p>
          <p className="lead">
            <strong>Checks and conversion.</strong> TPP checks values against the metric
            definitions, then reads or writes the data in formats other systems can use.
          </p>
          <p className="lead">
            <strong>Your scouting system.</strong> Keep your app and database. A developer
            integrates TPP where that system needs to read, write or exchange scouting data.
          </p>
        </div>
      </div>
    </section>
  );
}
