"use client";

import { useEffect, useRef } from "react";
import styles from "./Statement.module.css";

const LINE =
  "Every scouting app ends up writing its own Bluetooth layer. Pairing, reconnecting, retrying, losing a match because a tablet fell asleep. Prism does that job once, on one Raspberry Pi, for all of them.";

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
        <p className={`eyebrow ${styles.eyebrow}`}>What Prism is</p>
        <p ref={ref} className={styles.line}>
          {words.map((w, i) => (
            <span key={i}>{w} </span>
          ))}
        </p>

        <div className={styles.layers}>
          <div>
            <h3>The protocol</h3>
            <p>
              A small, documented contract for moving records between devices and a hub: how a
              device introduces itself, how a record is framed, and when it counts as delivered.
              Open, so any app can speak it.
            </p>
          </div>
          <div>
            <h3>Prism OS</h3>
            <p>
              A Raspberry Pi image that implements the protocol. It owns the Bluetooth radio,
              keeps every record on disk, and serves them on your local network. Flash it,
              power it, forget it.
            </p>
          </div>
          <div>
            <h3>Your app</h3>
            <p>
              Stays exactly what it is. It reads and writes JSON over HTTP or a WebSocket. Prism
              never looks inside your data, so your schema is yours.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
