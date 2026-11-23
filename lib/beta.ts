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

const redirect = () => `${window.location.origin}/beta`;

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
