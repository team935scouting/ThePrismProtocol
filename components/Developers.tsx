"use client";

import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";
import Segmented from "./Segmented";
import styles from "./Developers.module.css";

const SAMPLES = {
  convert: {
    label: "Convert a file",
    lang: "js",
    code: `const htmlPage = convert(csvText, {
  to: "html",
  page: true,
});`,
  },
  database: {
    label: "Use your database",
    lang: "js",
    code: `const doc = parse(fileFromAnotherTeam);
for (const record of doc.records) {
  await addDoc(collection(db, "matches"), record);
}`,
  },
} as const;

type Key = keyof typeof SAMPLES;
const KEYS = Object.keys(SAMPLES) as Key[];

const KEYWORDS = /^(const|let|async|await|for|of|import|from|new|return)$/;

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
  const [active, setActive] = useState<Key>("convert");
  const sample = SAMPLES[active];

  return (
    <section className={styles.section} id="developers" data-nav="dark">
      <div className={`wrap ${styles.grid}`}>
        <div className={styles.copy}>
          <p className="eyebrow">
            Developers
          </p>
          <h2 className={styles.title}>Add TPP to the app you already use.</h2>
          <p className={styles.lede}>
            A developer integrates TPP where scouting data enters or leaves your software. TPP
            can parse, check and convert records. Apps need to add TPP before they can exchange
            data through it.
          </p>
          <p className={styles.note}>
            Try the library with your team&apos;s scouting data. <Link href="/beta">Sign up for the beta</Link>
          </p>
          <p className={styles.note}>
            These examples show the v2 API. The npm package still installs v1.0.0; use the
            <a href="https://github.com/team935scouting/prism-protocol"> GitHub source</a> for current setup details.
          </p>
        </div>

        <div className={styles.window}>
          <div className={styles.chrome}>
            <Segmented
              options={KEYS.map((k) => ({ key: k, label: SAMPLES[k].label }))}
              value={active}
              onChange={setActive}
              label="TPP example"
              idPrefix="tab"
              panelId="code-panel"
            />
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
