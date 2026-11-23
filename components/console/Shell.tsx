"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { PrismMark } from "../Nav";
import { requestTeam, signOut, type Membership } from "@/lib/api";
import { Icon, type IconName } from "./Icon";
import { Button, ErrorNote, Loading, TextField, ToastProvider, styles as s } from "./ui";
import type { Session } from "@/lib/useSession";

export type NavSection<T extends string> = { id: T; label: string; icon: IconName; count?: number };

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** The current section lives in the URL hash so reloads and links land in the right place. */
export function useHashSection<T extends string>(ids: readonly T[], fallback: T): [T, (id: T) => void] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => "");
  const current = (ids as readonly string[]).includes(hash) ? (hash as T) : fallback;
  const set = (id: T) => {
    history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.scrollTo({ top: 0 });
  };
  return [current, set];
}

export function Shell<T extends string>({
  identity,
  sections,
  active,
  onSelect,
  extraLinks,
  children,
}: {
  identity: { big: string; sub: string };
  sections: NavSection<T>[];
  active: T;
  onSelect: (id: T) => void;
  extraLinks?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <div className={s.root}>
        <div className={s.shell}>
          <aside className={s.sidebar}>
            <Link href="/" className={s.brand}>
              <PrismMark />
              Prism
            </Link>
            <div className={s.identity}>
              <div className={s.big}>{identity.big}</div>
              <div className={s.sub}>{identity.sub}</div>
            </div>
            <nav aria-label="Sections">
              <ul className={s.nav}>
                {sections.map((sec) => (
                  <li key={sec.id}>
                    <button
                      type="button"
                      className={s.navItem}
                      aria-current={sec.id === active ? "page" : undefined}
                      onClick={() => onSelect(sec.id)}
                    >
                      <Icon name={sec.icon} size={18} />
                      {sec.label}
                      {sec.count ? <span className={s.count}>{sec.count}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className={s.sidebarFoot}>
              {extraLinks}
              <button type="button" className={s.navItem} onClick={() => signOut()}>
                <Icon name="signout" size={18} />
                Sign out
              </button>
            </div>
          </aside>
          <main className={s.main}>
            <div className={s.page}>{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

/* ---------- Full-page states before the console can open ---------- */

function Card({ children }: { children: ReactNode }) {
  return (
    <div className={s.root}>
      <div className={s.center}>
        <div className={s.card}>{children}</div>
      </div>
    </div>
  );
}

function SignedOut({ next }: { next: string }) {
  useEffect(() => {
    window.location.replace(`/beta?next=${encodeURIComponent(next)}`);
  }, [next]);
  return (
    <Card>
      <h1>Sign in to continue.</h1>
      <p className={s.lead}>Taking you to the sign-in page…</p>
    </Card>
  );
}

function PendingOrRejected({ membership, onChanged }: { membership: Membership; onChanged: () => void }) {
  const [team, setTeam] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (membership.status === "pending") {
    return (
      <Card>
        <h1>Waiting for Team {membership.team_number}.</h1>
        <p className={s.lead}>
          <strong>Your request is in.</strong> An owner or admin of Team {membership.team_number} needs to
          accept you. This page opens up as soon as they do.
        </p>
        <div className={s.actions}>
          <Button onClick={() => signOut()}>Sign out</Button>
          <Button variant="primary" onClick={onChanged}>
            Check again
          </Button>
        </div>
      </Card>
    );
  }

  const submit = async () => {
    const n = Number(team);
    if (!Number.isInteger(n) || n < 1 || n > 99999) {
      setError("Enter a team number between 1 and 99999.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await requestTeam(n);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h1>Team {membership.team_number} declined this request.</h1>
      <p className={s.lead}>
        <strong>Joined with the wrong number?</strong> Enter the right one and we&apos;ll send a new request.
      </p>
      <TextField label="Team number" inputMode="numeric" value={team} onChange={(e) => setTeam(e.target.value)} />
      <ErrorNote message={error} />
      <div className={s.actions}>
        <Button onClick={() => signOut()}>Sign out</Button>
        <Button variant="primary" onClick={submit} disabled={busy}>
          Request to join
        </Button>
      </div>
    </Card>
  );
}

/** Renders the right screen for any session state, and children only when ready. */
export function Gate({
  session,
  reload,
  next,
  children,
}: {
  session: Session;
  reload: () => void;
  next: string;
  children: (ready: Extract<Session, { kind: "ready" }>) => ReactNode;
}) {
  switch (session.kind) {
    case "loading":
      return (
        <div className={s.root}>
          <div className={s.center}>
            <div style={{ width: "min(480px, 100%)" }}>
              <Loading rows={3} />
            </div>
          </div>
        </div>
      );
    case "offline":
      return (
        <Card>
          <h1>Not connected yet.</h1>
          <p className={s.lead}>This build of the site isn&apos;t connected to the Prism account service.</p>
        </Card>
      );
    case "signedOut":
      return <SignedOut next={next} />;
    case "error":
      return (
        <Card>
          <h1>Something&apos;s not set up.</h1>
          <ErrorNote message={session.message} />
          <div className={s.actions}>
            <Button onClick={() => signOut()}>Sign out</Button>
            <Button variant="primary" onClick={reload}>
              Try again
            </Button>
          </div>
        </Card>
      );
    case "ready":
      if (session.membership.status !== "active") {
        return <PendingOrRejected membership={session.membership} onChanged={reload} />;
      }
      return <>{children(session)}</>;
  }
}
