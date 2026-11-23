"use client";

import { Fragment, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import LiquidGlass from "./LiquidGlass";
import styles from "./Developers.module.css";

const SAMPLES = {
  curl: {
    label: "curl",
    lang: "sh",
    code: `# Everything since the last record you saw
curl "http://prism.local/v1/records?since=1183"

[
  {
    "id": 1184,
    "device": "red-2",
    "received": "2027-03-14T10:42:07Z",
    "data": { "match": 18, "team": 935, "auto": { "leave": true } }
  }
]`,
  },
  js: {
    label: "JavaScript",
    lang: "js",
    code: `// Live stream of every record as it lands on the Pi
const ws = new WebSocket("ws://prism.local/v1/stream");

ws.onmessage = ({ data }) => {
  const record = JSON.parse(data);
  // record.data is exactly what your scouting form sent
  db.matches.insert(record.data);
};`,
  },
  py: {
    label: "Python",
    lang: "py",
    code: `import asyncio, json, websockets

async def main():
    async with websockets.connect("ws://prism.local/v1/stream") as ws:
        async for message in ws:
            record = json.loads(message)
            print(record["device"], record["data"]["team"])

asyncio.run(main())`,
  },
} as const;

type Key = keyof typeof SAMPLES;
const KEYS = Object.keys(SAMPLES) as Key[];

const ENDPOINTS = [
  { method: "GET", path: "/v1/devices", what: "Paired devices and when each was last seen" },
  { method: "GET", path: "/v1/records", what: "Stored records, filterable by ID or device" },
  { method: "WS", path: "/v1/stream", what: "Every new record, the moment it's stored" },
  { method: "POST", path: "/v1/broadcast", what: "Send a payload to every paired device" },
];

const KEYWORDS = /^(const|let|async|await|def|for|in|import|as|with|return|new|print)$/;

/** Small, honest highlighter: comments, strings, numbers, keywords. */
function highlight(code: string, lang: string): ReactNode[] {
  const comment = lang === "js" ? /\/\/.*/ : /#.*/;
  const re = new RegExp(`(${comment.source})|("(?:[^"\\\\]|\\\\.)*")|(\\b\\d+\\b)|(\\b[A-Za-z_]+\\b)`, "g");
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const [tok, c, s, n, w] = m;
    if (c) out.push(<span key={k++} className={styles.tComment}>{tok}</span>);
    else if (s) out.push(<span key={k++} className={styles.tString}>{tok}</span>);
    else if (n) out.push(<span key={k++} className={styles.tNumber}>{tok}</span>);
    else if (w && KEYWORDS.test(w)) out.push(<span key={k++} className={styles.tKeyword}>{tok}</span>);
    else out.push(tok);
    last = m.index + tok.length;
  }
  out.push(code.slice(last));
  return out;
}

export default function Developers() {
  const [active, setActive] = useState<Key>("curl");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = KEYS.indexOf(active);
  const sample = SAMPLES[active];

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : KEYS.length - 1)) % KEYS.length;
    setActive(KEYS[next]);
    tabs.current[next]?.focus();
  };

  return (
    <section className={styles.section} id="developers" data-nav="dark">
      <div className={`wrap ${styles.grid}`}>
        <div className={styles.copy}>
          <p className="eyebrow" style={{ color: "var(--muted-on-dark)" }}>
            Developers
          </p>
          <h2 className={styles.title}>Your app speaks HTTP. Prism handles the radio.</h2>
          <p className={styles.lede}>
            No SDK and no Bluetooth code in your app. Point it at the Pi and read JSON. If your
            scouting app already runs in a browser, it already has everything it needs.
          </p>
          <ul className={styles.endpoints}>
            {ENDPOINTS.map((e) => (
              <li key={e.path}>
                <code>
                  <span className={styles.method}>{e.method}</span> {e.path}
                </code>
                <span>{e.what}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>Developer preview. Endpoints may change before 1.0.</p>
        </div>

        <div className={styles.window}>
          <div className={styles.chrome}>
            <div className={styles.segmented} role="tablist" aria-label="Code sample language" onKeyDown={onKeyDown}>
              {KEYS.map((key, i) => (
                <button
                  key={key}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  role="tab"
                  type="button"
                  id={`tab-${key}`}
                  aria-selected={active === key}
                  aria-controls="code-panel"
                  tabIndex={active === key ? 0 : -1}
                  className={styles.segment}
                  onClick={() => setActive(key)}
                >
                  {SAMPLES[key].label}
                </button>
              ))}
              {/* The selection is a lens sliding over the labels. */}
              <LiquidGlass
                tone="dark"
                bezel={9}
                strength={18}
                blur={0}
                aria-hidden="true"
                className={styles.thumb}
                style={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  width: `calc((100% - 8px) / ${KEYS.length})`,
                  height: "calc(100% - 8px)",
                  transform: `translateX(${index * 100}%)`,
                }}
              />
            </div>
          </div>
          <pre id="code-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className={styles.code} tabIndex={0}>
            <code>
              {highlight(sample.code, sample.lang).map((n, i) => (
                <Fragment key={i}>{n}</Fragment>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
