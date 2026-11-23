import { BetaNotConnected, friendly, supabase, supabaseConfigured } from "./supabase";

/** Developer beta accounts, backed by Supabase Auth. See lib/supabase.ts. */

export { BetaNotConnected };
export const betaConnected = supabaseConfigured;

export type SignUp = {
  name: string;
  email: string;
  password: string;
  team: number;
  updates: boolean;
};

export type SignIn = { email: string; password: string };

/**
 * Where confirmation and password-reset emails send people. Always the live site, even
 * when someone signs up from a local dev server or a preview deployment:
 *   1. NEXT_PUBLIC_SITE_URL, if set (e.g. https://theprisimprotocol.dev)
 *   2. Vercel's production domain, which Vercel provides to every build
 *   3. whatever site this page is on
 * The address must also be allowed in Supabase → Authentication → URL Configuration.
 */
export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return window.location.origin;
}

const redirect = () => `${siteUrl()}/beta`;

/** Returns whether the new account still has to confirm its email address. */
export async function signUp({ name, email, password, team, updates }: SignUp) {
  const { data, error } = await supabase().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirect(),
      data: { name, team, beta_updates: updates },
    },
  });
  if (error) throw new Error(friendly(error.message));
  return { needsConfirmation: !data.session };
}

export async function signIn({ email, password }: SignIn) {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error.message));
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: redirect() });
  if (error) throw new Error(friendly(error.message));
}

export async function currentUser() {
  if (!betaConnected) return null;
  const { data } = await supabase().auth.getUser();
  return data.user;
}

export async function signOut() {
  await supabase().auth.signOut();
}

/** Fires when someone lands here from a password-reset email. */
export function onPasswordRecovery(cb: () => void) {
  if (!betaConnected) return () => {};
  const { data } = supabase().auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") cb();
  });
  return () => data.subscription.unsubscribe();
}

export async function updatePassword(password: string) {
  const { error } = await supabase().auth.updateUser({ password });
  if (error) throw new Error(friendly(error.message));
}
