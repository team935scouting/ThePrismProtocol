"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./HowItWorks.module.css";
import { useReducedMotion } from "@/lib/useMedia";

const STEPS = [
  {
    title: "Flash",
    body: "Write Prism OS to a microSD card with Raspberry Pi Imager and power the Pi on. It boots headless and answers at prism.local.",
  },
  {
    title: "Pair",
    body: "Each scout's tablet pairs once over Bluetooth Low Energy. Prism remembers it and reconnects on its own when the tablet wakes up between matches.",
  },
  {
    title: "Collect",
    body: "A scout submits a match. The tablet sends the record, Prism writes it to disk, then acknowledges. Until that acknowledgement arrives, the tablet keeps its copy.",
  },
  {
    title: "Read",
    body: "Your app pulls records over HTTP or streams them live from a WebSocket. Any language that can open a socket can use it.",
  },
];

const SCOUTS = [
  { id: "Red 1", alliance: "red" },
  { id: "Red 2", alliance: "red" },
  { id: "Red 3", alliance: "red" },
  { id: "Blue 1", alliance: "blue" },
  { id: "Blue 2", alliance: "blue" },
  { id: "Blue 3", alliance: "blue" },
] as const;

const ALLIANCE = { red: "#e5362b", blue: "#1f6feb" };

// Diagram geometry (viewBox 0 0 640 500)
const TAB_X = 24;
const TAB_W = 96;
const TAB_H = 52;
const tabY = (i: number) => 34 + i * 74;
const PI = { x: 268, y: 190, w: 148, h: 112 };
const LAP = { x: 488, y: 196, w: 132, h: 86 };

function linkPath(i: number) {
  const x0 = TAB_X + TAB_W;
  const y0 = tabY(i) + TAB_H / 2;
  const x1 = PI.x;
  const y1 = PI.y + 26 + i * 12;
  const mx = (x0 + x1) / 2;
  return `M${x0} ${y0} C${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
}
const UPLINK = `M${PI.x + PI.w} ${PI.y + PI.h / 2} L${LAP.x} ${PI.y + PI.h / 2}`;

/** Mounted only while records are flowing, so it starts from zero each time. */
function RecordCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCount((c) => c + 1), 300);
    return () => clearInterval(t);
  }, []);
  return <>{count} records stored</>;
}

function Diagram({ step, reduced }: { step: number; reduced: boolean }) {
  return (
    <svg className={styles.diagram} viewBox="0 0 640 500" data-step={step} role="img" aria-label={`Diagram: step ${step + 1}, ${STEPS[step].title}`}>
      {/* Links: tablets to Pi */}
      {SCOUTS.map((s, i) => (
        <path
          key={s.id}
          id={`link-${i}`}
          d={linkPath(i)}
          pathLength={1}
          className={styles.link}
          style={{ transitionDelay: `${i * 70}ms` }}
          data-on={step >= 1 ? "" : undefined}
        />
      ))}
      <path id="uplink" d={UPLINK} pathLength={1} className={styles.link} data-on={step >= 3 ? "" : undefined} />

      {/* Records in flight */}
      {step >= 2 &&
        !reduced &&
        SCOUTS.map((s, i) => (
          <circle key={s.id} r="4" fill={ALLIANCE[s.alliance]}>
            <animateMotion dur="1.6s" begin={`${i * 0.27}s`} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1">
              <mpath href={`#link-${i}`} />
            </animateMotion>
          </circle>
        ))}
      {step >= 3 && !reduced && (
        <>
          <circle r="4" fill="#1d1d1f">
            <animateMotion dur="0.9s" repeatCount="indefinite" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.4 0 0.2 1">
              <mpath href="#uplink" />
            </animateMotion>
          </circle>
          <circle r="4" fill="#1d1d1f">
            <animateMotion dur="0.9s" begin="0.45s" repeatCount="indefinite" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.4 0 0.2 1">
              <mpath href="#uplink" />
            </animateMotion>
          </circle>
        </>
      )}

      {/* Tablets */}
      {SCOUTS.map((s, i) => (
        <g key={s.id} className={styles.tablet} data-on={step >= 1 ? "" : undefined} style={{ transitionDelay: `${i * 70}ms` }}>
          <rect x={TAB_X} y={tabY(i)} width={TAB_W} height={TAB_H} rx="9" className={styles.device} />
          <rect x={TAB_X + 6} y={tabY(i) + 6} width={TAB_W - 12} height={TAB_H - 12} rx="4" className={styles.screen} />
          <circle cx={TAB_X + 18} cy={tabY(i) + TAB_H / 2} r="4" fill={ALLIANCE[s.alliance]} />
          <text x={TAB_X + 30} y={tabY(i) + TAB_H / 2 + 4.5} className={styles.label}>
            {s.id}
          </text>
        </g>
      ))}

      {/* Raspberry Pi */}
      <g className={styles.pi} data-on={step >= 0 ? "" : undefined}>
        <rect x={PI.x} y={PI.y} width={PI.w} height={PI.h} rx="10" className={styles.board} />
        {Array.from({ length: 14 }).map((_, i) => (
          <circle key={i} cx={PI.x + 16 + i * 8.8} cy={PI.y + 10} r="1.8" className={styles.pin} />
        ))}
        <rect x={PI.x + 22} y={PI.y + 34} width="44" height="44" rx="4" className={styles.chip} />
        <rect x={PI.x + 80} y={PI.y + 36} width="22" height="16" rx="2" className={styles.chip2} />
        <rect x={PI.x + 80} y={PI.y + 58} width="22" height="16" rx="2" className={styles.chip2} />
        <rect x={PI.x + PI.w - 22} y={PI.y + 30} width="14" height="22" rx="2" className={styles.chip2} />
        <rect x={PI.x + PI.w - 22} y={PI.y + 60} width="14" height="22" rx="2" className={styles.chip2} />
        <circle cx={PI.x + 12} cy={PI.y + PI.h - 12} r="3.5" className={styles.led} data-on={step >= 0 ? "" : undefined} />
        <text x={PI.x + PI.w / 2} y={PI.y + PI.h + 26} textAnchor="middle" className={styles.host}>
          prism.local
        </text>
        <text x={PI.x + PI.w / 2} y={PI.y + PI.h + 46} textAnchor="middle" className={styles.meta}>
          {step >= 2 ? <RecordCount /> : step >= 1 ? "6 devices paired" : "ready"}
        </text>
      </g>

      {/* Laptop running "your app" */}
      <g className={styles.laptop} data-on={step >= 3 ? "" : undefined}>
        <rect x={LAP.x} y={LAP.y} width={LAP.w} height={LAP.h} rx="7" className={styles.device} />
        <rect x={LAP.x + 6} y={LAP.y + 6} width={LAP.w - 12} height={LAP.h - 12} rx="3" className={styles.screen} />
        <path d={`M${LAP.x - 12} ${LAP.y + LAP.h + 2} h${LAP.w + 24} l-8 8 h-${LAP.w + 8} z`} className={styles.device} />
        {[0, 1, 2, 3, 4].map((r) => (
          <g key={r} className={styles.row} style={{ transitionDelay: `${200 + r * 90}ms` }}>
            <rect x={LAP.x + 14} y={LAP.y + 16 + r * 11} width="18" height="5" rx="2" fill={r % 2 ? ALLIANCE.blue : ALLIANCE.red} />
            <rect x={LAP.x + 38} y={LAP.y + 16 + r * 11} width={50 - (r % 3) * 9} height="5" rx="2" className={styles.cell} />
            <rect x={LAP.x + 96} y={LAP.y + 16 + r * 11} width="20" height="5" rx="2" className={styles.cell} />
          </g>
        ))}
        <text x={LAP.x + LAP.w / 2} y={LAP.y + LAP.h + 36} textAnchor="middle" className={styles.host}>
          Your scouting app
        </text>
      </g>
    </svg>
  );
}

export default function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = Math.min(0.9999, Math.max(0, -r.top / span));
      setStep(Math.floor(p * STEPS.length));
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

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * ((i + 0.5) / STEPS.length), behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <section ref={ref} className={styles.section} id="how" data-nav="light">
      <div className={styles.sticky}>
        <div className={`wrap ${styles.grid}`}>
          <div className={styles.text}>
            <p className="eyebrow">
              How it works
            </p>
            <h2 className={styles.title}>From the stands to your database in four steps.</h2>
            <ol className={styles.steps}>
              {STEPS.map((s, i) => (
                <li key={s.title} data-active={i === step ? "" : undefined}>
                  <button type="button" onClick={() => goTo(i)} aria-current={i === step ? "step" : undefined}>
                    <strong>{s.title}.</strong> <span className={styles.rest}>{s.body}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.visual}>
            <Diagram step={step} reduced={reduced} />
          </div>
        </div>
      </div>
    </section>
  );
}
