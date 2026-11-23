"use client";

import { useEffect, useState } from "react";
import LiquidGlass from "./LiquidGlass";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#protocol", label: "Protocol" },
  { href: "#developers", label: "Developers" },
];

export function PrismMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.2 18 16.6H2Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 2.2 10 16.6" stroke="currentColor" strokeWidth="1" opacity="0.45" />
    </svg>
  );
}

/** The bar adapts to whatever is underneath it, like system glass does. */
export default function Nav() {
  const [tone, setTone] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-nav]"));
    let frame = 0;
    const update = () => {
      frame = 0;
      const probe = 36;
      const hit = sections.find((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= probe && r.bottom > probe;
      });
      if (hit) setTone(hit.dataset.nav === "light" ? "light" : "dark");
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
    <header className={styles.bar} data-tone={tone}>
      <LiquidGlass as="nav" tone={tone} className={styles.pill} aria-label="Primary" bezel={12} strength={30}>
        <a href="#top" className={styles.brand}>
          <PrismMark />
          Prism
        </a>
        <ul className={styles.links}>
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>
        <a href="#download" className={styles.cta}>
          Download
        </a>
      </LiquidGlass>
    </header>
  );
}
