"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureMembership, getTeam, getUser, type Membership, type Team } from "./api";
import { BetaNotConnected, supabase, supabaseConfigured } from "./supabase";

export type Session =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "signedOut" }
  | { kind: "error"; message: string; email?: string }
  | {
      kind: "ready";
      user: { id: string; email: string };
      membership: Membership;
      team: Team;
      isStaff: boolean;
      isManager: boolean;
    };

/** Signs the visitor in to the console: user, their team membership and the team. */
export function useSession() {
  const [session, setSession] = useState<Session>({ kind: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    const load = async (): Promise<Session> => {
      if (!supabaseConfigured) return { kind: "offline" };
      const user = await getUser();
      if (!user) return { kind: "signedOut" };
      const email = user.email ?? "";
      try {
        const membership = await ensureMembership();
        if (!membership) return { kind: "error", message: "We couldn't find your team.", email };
        const team = await getTeam(membership.team_id);
        const active = membership.status === "active";
        return {
          kind: "ready",
          user: { id: user.id, email },
          membership,
          team,
          isStaff: active && membership.team_number === 935,
          isManager: active && (membership.role === "owner" || membership.role === "admin"),
        };
      } catch (err) {
        if (err instanceof BetaNotConnected) return { kind: "offline" };
        return { kind: "error", message: err instanceof Error ? err.message : String(err), email };
      }
    };
    load().then((s) => live && setSession(s));
    return () => {
      live = false;
    };
  }, [version]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setSession({ kind: "signedOut" });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { session, reload };
}
