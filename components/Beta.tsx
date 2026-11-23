"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import LiquidGlass from "./LiquidGlass";
import Segmented from "./Segmented";
import {
  BetaNotConnected,
  currentUser,
  onPasswordRecovery,
  sendPasswordReset,
  signIn,
  signOut,
  signUp,
  updatePassword,
} from "@/lib/beta";
import { useReducedMotion } from "@/lib/useMedia";
import type { PrismControls } from "./PrismScene";
import styles from "./Beta.module.css";

const PrismScene = dynamic(() => import("./PrismScene"), { ssr: false });

type Mode = "join" | "signin";
type Status =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "error"; message: string }
  | { kind: "offline" }
  | { kind: "confirm"; email: string }
  | { kind: "resetSent"; email: string }
  | { kind: "recovery" }
  | { kind: "done"; email: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Where to go after signing in: a same-site path from ?next=, or the dashboard. */
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

/** Apple-style field: the label sits inside the box and floats up once there's a value. */
export function Field({
  label,
  hint,
  error,
  ...input
}: { label: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={styles.field} data-invalid={error ? "" : undefined}>
      <input id={id} placeholder=" " aria-invalid={Boolean(error)} aria-describedby={describedBy} {...input} />
      <label htmlFor={id}>{label}</label>
      {error ? (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default function Beta() {
  const controls = useRef<PrismControls>({ drag: 0, scroll: 0 });
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("join");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  // Already signed in (or just back from the confirmation email)? Show the account.
  useEffect(() => {
    let live = true;
    currentUser()
      .then((user) => {
        if (live && user?.email) setStatus({ kind: "done", email: user.email });
      })
      .catch(() => {});
    const stop = onPasswordRecovery(() => setStatus({ kind: "recovery" }));
    return () => {
      live = false;
      stop();
    };
  }, []);

  const validate = (data: FormData) => {
    const next: Record<string, string> = {};
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (mode === "join" && !String(data.get("name") ?? "").trim()) next.name = "Enter your name.";
    if (!EMAIL.test(email)) next.email = "Enter a valid email address.";
    if (mode === "join" && password.length < 8) next.password = "Use at least 8 characters.";
    if (mode === "signin" && !password) next.password = "Enter your password.";
    const team = String(data.get("team") ?? "").trim();
    if (mode === "join" && (!/^\d{1,5}$/.test(team) || Number(team) < 1)) next.team = "Enter your team number.";
    return next;
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const found = validate(data);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = e.currentTarget.querySelector<HTMLInputElement>("[aria-invalid='true']");
      first?.focus();
      return;
    }
    setStatus({ kind: "busy" });
    try {
      const email = String(data.get("email")).trim();
      const password = String(data.get("password"));
      if (mode === "join") {
        const { needsConfirmation } = await signUp({
          name: String(data.get("name")).trim(),
          email,
          password,
          team: Number(String(data.get("team")).trim()),
          updates: data.get("updates") === "on",
        });
        setStatus(needsConfirmation ? { kind: "confirm", email } : { kind: "done", email });
      } else {
        await signIn({ email, password });
        window.location.assign(nextPath());
      }
    } catch (err) {
      fail(err);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setErrors({});
    setStatus({ kind: "idle" });
  };

  function fail(err: unknown) {
    if (err instanceof BetaNotConnected) setStatus({ kind: "offline" });
    else setStatus({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
  }

  const onForgot = async () => {
    const email = String(new FormData(formRef.current ?? undefined).get("email") ?? "").trim();
    if (!EMAIL.test(email)) {
      setErrors({ email: "Enter your email above, then choose Forgot password." });
      return;
    }
    setErrors({});
    setStatus({ kind: "busy" });
    try {
      await sendPasswordReset(email);
      setStatus({ kind: "resetSent", email });
    } catch (err) {
      fail(err);
    }
  };

  const onNewPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < 8) {
      setErrors({ password: "Use at least 8 characters." });
      return;
    }
    setErrors({});
    try {
      await updatePassword(password);
      const user = await currentUser();
      setStatus({ kind: "done", email: user?.email ?? "" });
    } catch (err) {
      fail(err);
    }
  };

  const onSignOut = async () => {
    await signOut().catch(() => {});
    setMode("signin");
    setStatus({ kind: "idle" });
  };

  const busy = status.kind === "busy";

  return (
    <section className={styles.page} data-nav="dark">
      <div className={styles.stage} data-ready={ready ? "" : undefined} aria-hidden="true">
        <PrismScene active reduced={reduced} controls={controls} onReady={() => setReady(true)} />
      </div>
      <div className={styles.scrim} aria-hidden="true" />

      <div className={`wrap ${styles.layout}`}>
        <LiquidGlass tone="dark" radius={30} bezel={20} strength={28} className={styles.sheet}>
          <div className={styles.inner}>
            {status.kind === "done" ? (
              <div className={styles.done} role="status">
                <p className="eyebrow">Developer beta</p>
                <h1 className={styles.title}>You&apos;re in.</h1>
                <p className="lead">
                  <strong>Signed in{status.email ? ` as ${status.email}` : ""}.</strong> New Prism OS
                  builds go to beta accounts first.
                </p>
                <Link href="/dashboard" className={styles.submit}>
                  Open your dashboard
                </Link>
                <button type="button" className={styles.textButton} onClick={onSignOut}>
                  Sign out
                </button>
              </div>
            ) : status.kind === "confirm" || status.kind === "resetSent" ? (
              <div className={styles.done} role="status">
                <p className="eyebrow">Developer beta</p>
                <h1 className={styles.title}>Check your email.</h1>
                <p className="lead">
                  <strong>
                    {status.kind === "confirm" ? "One step left." : "A reset link is on its way."}
                  </strong>{" "}
                  We sent a link to {status.email}.{" "}
                  {status.kind === "confirm"
                    ? "Open it on this device to finish creating your account."
                    : "Open it to choose a new password."}
                </p>
                <button type="button" className={styles.textButton} onClick={() => switchMode("signin")}>
                  Back to sign in
                </button>
              </div>
            ) : status.kind === "recovery" ? (
              <form className={styles.done} onSubmit={onNewPassword} noValidate>
                <p className="eyebrow">Developer beta</p>
                <h1 className={styles.title}>Choose a new password.</h1>
                <Field
                  label="New password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  hint="At least 8 characters."
                  error={errors.password}
                />
                <button type="submit" className={styles.submit}>
                  Save password
                </button>
              </form>
            ) : (
              <>
                <p className="eyebrow">Developer beta</p>
                <h1 className={styles.title}>{mode === "join" ? "Build on Prism early." : "Sign in to the beta."}</h1>
                <p className={`lead ${styles.intro}`}>
                  {mode === "join" ? (
                    <>
                      <strong>Prism OS builds before they ship.</strong> Test the API against a real Pi
                      and tell us what breaks.
                    </>
                  ) : (
                    <>
                      <strong>Welcome back.</strong> Use the email you joined with.
                    </>
                  )}
                </p>

                <Segmented
                  options={[
                    { key: "join", label: "Create account" },
                    { key: "signin", label: "Sign in" },
                  ]}
                  value={mode}
                  onChange={switchMode}
                  label="Account"
                  idPrefix="beta"
                  panelId="beta-form"
                  className={styles.switch}
                />

                <form
                  id="beta-form"
                  role="tabpanel"
                  aria-labelledby={`beta-${mode}`}
                  className={styles.form}
                  onSubmit={onSubmit}
                  ref={formRef}
                  noValidate
                  key={mode}
                >
                  {mode === "join" && <Field label="Name" name="name" autoComplete="name" error={errors.name} />}
                  <Field label="Email" name="email" type="email" autoComplete="email" inputMode="email" error={errors.email} />
                  <Field
                    label="Password"
                    name="password"
                    type="password"
                    autoComplete={mode === "join" ? "new-password" : "current-password"}
                    hint={mode === "join" ? "At least 8 characters." : undefined}
                    error={errors.password}
                  />
                  {mode === "join" && (
                    <>
                      <Field
                        label="Team number"
                        name="team"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={5}
                        hint="The first account for a team becomes its owner. Everyone after joins once accepted."
                        error={errors.team}
                      />
                      <label className={styles.check}>
                        <input type="checkbox" name="updates" />
                        <span>Email me when a new beta build is ready.</span>
                      </label>
                    </>
                  )}

                  {status.kind === "offline" && (
                    <p className={styles.notice} role="status">
                      The beta isn&apos;t taking accounts yet, so nothing was sent. Check back soon.
                    </p>
                  )}
                  {status.kind === "error" && (
                    <p className={styles.notice} data-kind="error" role="alert">
                      {status.message}
                    </p>
                  )}

                  <button type="submit" className={styles.submit} disabled={busy} aria-busy={busy}>
                    {busy ? "One moment…" : mode === "join" ? "Create beta account" : "Sign in"}
                  </button>

                  {mode === "signin" && (
                    <button type="button" className={styles.textButton} onClick={onForgot} disabled={busy}>
                      Forgot password?
                    </button>
                  )}
                </form>
              </>
            )}
          </div>
        </LiquidGlass>
      </div>
    </section>
  );
}
