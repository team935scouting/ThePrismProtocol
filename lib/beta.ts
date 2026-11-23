import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Developer beta accounts, backed by Supabase Auth.
 *
 * The site is a static export, so these run in the browser with the project's public
 * (anon / publishable) key. That key is designed to be public; what protects data is
 * Supabase Auth plus row-level security. Never put a service-role key here.
 *
 * Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY at build time
 * (see .env.example). Until they're set, the form says sign-ups aren't connected.
 */

export type SignUp = {
  name: string;
  email: string;
  password: string;
  team?: string;
  updates: boolean;
};

export type SignIn = { email: string; password: string };

export class BetaNotConnected extends Error {
  constructor() {
    super("The developer beta isn't accepting accounts yet.");
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const betaConnected = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
function supabase() {
  if (!URL || !KEY) throw new BetaNotConnected();
  client ??= createClient(URL, KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  return client;
}

/** Supabase's messages are written for developers; these are written for scouts. */
function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match an account.";
  if (m.includes("email not confirmed")) return "Confirm your email first. The link is in your inbox.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("password should be")) return "Choose a longer password.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Couldn't reach the beta server. Check your connection.";
  return message;
}

const redirect = () => `${window.location.origin}/beta`;

/** Returns whether the new account still has to confirm its email address. */
export async function signUp({ name, email, password, team, updates }: SignUp) {
  const { data, error } = await supabase().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirect(),
      data: { name, team: team ?? null, beta_updates: updates },
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
