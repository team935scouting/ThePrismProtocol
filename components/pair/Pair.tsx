"use client";

import Link from "next/link";
import { useState } from "react";
import { claimPairing, deviceStatus, type DeviceKind, type DeviceStatus } from "@/lib/api";
import { supabaseConfigured } from "@/lib/supabase";
import { useQuery } from "@/lib/useQuery";
import { Field } from "../Beta";
import LiquidGlass from "../LiquidGlass";
import { PrismMark } from "../Nav";
import Segmented from "../Segmented";
import beta from "../Beta.module.css";
import styles from "./Pair.module.css";

const TOKEN_KEY = "prism.device.token";

function readToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the device works for this visit only */
  }
}

/** A sensible default name and type from the browser, so pairing is one tap for most people. */
function guessDevice(): { kind: DeviceKind; name: string; platform: string } {
  const ua = navigator.userAgent;
  const android = ua.match(/Android\s([\d.]+)/);
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return { kind: "tablet", name: "iPad", platform: "iPadOS" };
  if (/iPhone/.test(ua)) return { kind: "phone", name: "iPhone", platform: "iOS" };
  if (android) {
    const phone = /Mobile/.test(ua);
    return {
      kind: phone ? "phone" : "tablet",
      name: phone ? "Android phone" : "Android tablet",
      platform: `Android ${android[1]}`,
    };
  }
  if (/CrOS/.test(ua)) return { kind: "laptop", name: "Chromebook", platform: "ChromeOS" };
  if (/Windows/.test(ua)) return { kind: "laptop", name: "Windows laptop", platform: "Windows" };
  if (/Macintosh/.test(ua)) return { kind: "laptop", name: "Mac", platform: "macOS" };
  if (/Linux/.test(ua)) return { kind: "other", name: "Linux device", platform: "Linux" };
  return { kind: "other", name: "Device", platform: "" };
}

const KINDS: { key: DeviceKind; label: string }[] = [
  { key: "phone", label: "Phone" },
  { key: "tablet", label: "Tablet" },
  { key: "laptop", label: "Laptop" },
  { key: "other", label: "Other" },
];

function Status({ token, onForget }: { token: string; onForget: () => void }) {
  const { data, error, loading } = useQuery<DeviceStatus | null>(() => deviceStatus(token), [token]);

  if (loading && !data) return <p className={styles.muted}>Checking this device…</p>;
  if (error) return <p className={beta.notice} data-kind="error" role="alert">{error}</p>;
  if (!data) {
    return (
      <>
        <h1 className={beta.title}>This device was removed.</h1>
        <p className="lead">
          <strong>Its team deleted it.</strong> Pair it again with a new code from the dashboard.
        </p>
        <button type="button" className={beta.submit} onClick={onForget}>
          Pair again
        </button>
      </>
    );
  }

  const revoked = data.status === "revoked";
  return (
    <>
      <p className="eyebrow">Team {data.team_number}</p>
      <h1 className={beta.title}>{data.name}</h1>
      <p className="lead">
        {revoked ? (
          <>
            <strong>Access is paused.</strong> A team admin revoked this device.
          </>
        ) : data.software.length ? (
          <>
            <strong>Ready.</strong> Here&apos;s what your team has allowed on this device.
          </>
        ) : (
          <>
            <strong>Paired.</strong> A team admin can now choose what software this device runs.
          </>
        )}
      </p>
      {!revoked && data.software.length > 0 && (
        <ul className={styles.list}>
          {data.software.map((sw) => (
            <li key={sw.slug}>
              <div>
                <b>{sw.name}</b>
                <span>
                  {sw.release ? `${sw.release.version} · ` : ""}
                  {sw.channel === "beta" ? "Beta channel" : "Stable channel"}
                </span>
              </div>
              {sw.release?.download_url ? (
                <a href={sw.release.download_url} className={styles.get}>
                  Get
                </a>
              ) : (
                <span className={styles.muted}>No build yet</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={styles.textButton}
        onClick={() => {
          if (window.confirm("Forget this device's pairing? You'll need a new code to pair it again.")) onForget();
        }}
      >
        Forget pairing on this device
      </button>
    </>
  );
}

export default function Pair() {
  const [token, setToken] = useState(readToken);
  const [guess] = useState(guessDevice);
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("code") ?? "");
  const [name, setName] = useState(guess.name);
  const [kind, setKind] = useState<DeviceKind>(guess.kind === "pi" ? "other" : guess.kind);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const forget = () => {
    writeToken(null);
    setToken(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (clean.length !== 8) {
      setError("Pairing codes are 8 letters and numbers.");
      return;
    }
    if (!name.trim()) {
      setError("Give this device a name your team will recognise.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await claimPairing(clean, name.trim(), kind, guess.platform);
      writeToken(res.device_token);
      setToken(res.device_token);
      history.replaceState(null, "", "/pair");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.page} data-nav="dark">
      <Link href="/" className={styles.brand}>
        <PrismMark />
        Prism
      </Link>
      <LiquidGlass tone="dark" radius={30} bezel={20} strength={24} className={`${beta.sheet} ${styles.sheet}`}>
        <div className={beta.inner}>
          {!supabaseConfigured ? (
            <>
              <h1 className={beta.title}>Not connected yet.</h1>
              <p className="lead">This build of the site isn&apos;t connected to Prism accounts.</p>
            </>
          ) : token ? (
            <Status token={token} onForget={forget} />
          ) : (
            <>
              <p className="eyebrow">Add this device</p>
              <h1 className={beta.title}>Join your team&apos;s devices.</h1>
              <p className={`lead ${beta.intro}`}>
                <strong>One step.</strong> Name it so your team knows which one it is in the stands.
              </p>
              <form className={beta.form} onSubmit={submit} noValidate>
                <Field
                  label="Pairing code"
                  name="code"
                  value={code}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={9}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <Field
                  label="Device name"
                  name="name"
                  value={name}
                  maxLength={60}
                  hint="For example, Red 2 tablet."
                  onChange={(e) => setName(e.target.value)}
                />
                <Segmented
                  options={KINDS}
                  value={kind}
                  onChange={setKind}
                  label="Device type"
                  idPrefix="kind"
                  panelId="pair-form"
                />
                {error && (
                  <p className={beta.notice} data-kind="error" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" className={beta.submit} disabled={busy} aria-busy={busy}>
                  {busy ? "Pairing…" : "Pair this device"}
                </button>
              </form>
            </>
          )}
        </div>
      </LiquidGlass>
    </main>
  );
}
