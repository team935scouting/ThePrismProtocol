import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * One browser-side Supabase client for the whole site.
 *
 * The site is a static export, so this uses the project's public (anon / publishable)
 * key. That key is designed to be public; what protects data is the row-level security
 * in supabase/migrations. Never put a service-role key here.
 */

export class BetaNotConnected extends Error {
  constructor() {
    super("The developer beta isn't accepting accounts yet.");
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

export function supabase() {
  if (!URL || !KEY) throw new BetaNotConnected();
  client ??= createClient(URL, KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  return client;
}

/** Turns Supabase/Postgres messages into sentences people can act on. */
export function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match an account.";
  if (m.includes("email not confirmed")) return "Confirm your email first. The link is in your inbox.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("password should be")) return "Choose a longer password.";
  if (m.includes("failed to fetch") || m.includes("networkerror")) return "Couldn't reach Prism. Check your connection.";
  if (m.includes("row-level security") || m.includes("permission denied")) return "You don't have permission to do that.";
  if (m.includes("could not find the function") || (m.includes("relation") && m.includes("does not exist")))
    return "Prism's database isn't set up yet. Run the migration in supabase/migrations.";
  if (m.includes("duplicate key")) return "That already exists.";
  if (m.includes("violates check constraint")) return "One of those values isn't allowed. Check the format and length.";
  return message;
}
