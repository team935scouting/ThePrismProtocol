import { friendly, supabase } from "./supabase";

/* Everything the dashboard and admin console read and write. Permissions are enforced
   by row-level security in Postgres; these functions only shape the requests. */

export type Role = "owner" | "admin" | "developer";
export type MemberStatus = "pending" | "active" | "rejected";
export type DeviceKind = "phone" | "tablet" | "laptop" | "pi" | "other";
export type Channel = "stable" | "beta";
export type PostKind = "suggestion" | "bug" | "question";
export type PostStatus = "open" | "planned" | "in_progress" | "done" | "declined";
export type ProgramStatus = "draft" | "open" | "closed";

export type Membership = { team_id: string; team_number: number; role: Role; status: MemberStatus };
export type Team = { id: string; number: number; name: string | null; created_at: string };
export type Profile = { user_id: string; name: string; email: string; beta_updates: boolean; created_at: string };
export type Member = {
  user_id: string;
  team_id: string;
  role: Role;
  status: MemberStatus;
  created_at: string;
  profile: { name: string; email: string } | null;
};
export type Device = {
  id: string;
  team_id: string;
  name: string;
  kind: DeviceKind;
  platform: string | null;
  status: "active" | "revoked";
  created_at: string;
  last_seen_at: string | null;
  team?: { number: number } | null;
};
export type Software = { id: string; slug: string; name: string; description: string | null; created_at: string };
export type Release = {
  id: string;
  software_id: string;
  version: string;
  channel: Channel;
  notes: string | null;
  download_url: string | null;
  published: boolean;
  created_at: string;
};
export type Access = { device_id: string; software_id: string; channel: Channel };
export type Program = {
  id: string;
  title: string;
  description: string;
  software_id: string | null;
  status: ProgramStatus;
  created_at: string;
  software?: { name: string } | null;
};
export type Post = {
  id: string;
  author_id: string;
  author_name: string;
  team_number: number | null;
  kind: PostKind;
  title: string;
  body: string;
  status: PostStatus;
  pinned: boolean;
  hidden: boolean;
  admin_note: string | null;
  created_at: string;
  votes: { count: number }[];
};
export type SiteSettings = {
  announcement: string | null;
  announcement_url: string | null;
  signups_open: boolean;
  updated_at: string;
};
export type TeamSummary = Team & { team_members: { count: number }[]; devices: { count: number }[] };
export type DeviceStatus = {
  id: string;
  name: string;
  kind: DeviceKind;
  status: "active" | "revoked";
  team_number: number;
  software: {
    name: string;
    slug: string;
    channel: Channel;
    release: { version: string; download_url: string | null; notes: string | null } | null;
  }[];
};

// supabase-js infers embedded relations as arrays; our selects embed to-one relations,
// so responses are typed by the declared shapes above instead.
type Result = { data: unknown; error: { message: string } | null };

function ok<T = unknown>(r: Result): T {
  if (r.error) throw new Error(friendly(r.error.message));
  return r.data as T;
}

const db = () => supabase();
const DEVICE_COLS = "id, team_id, name, kind, platform, status, created_at, last_seen_at";

/* ---------- Session ---------- */

export async function getUser() {
  const { data } = await db().auth.getUser();
  return data.user;
}

export async function ensureMembership(): Promise<Membership | null> {
  const rows = ok<Membership[]>(await db().rpc("prism_ensure_membership"));
  return rows?.[0] ?? null;
}

export async function signOut() {
  await db().auth.signOut();
}

export async function requestTeam(team: number) {
  const auth = await db().auth.updateUser({ data: { team } });
  if (auth.error) throw new Error(friendly(auth.error.message));
  ok(await db().rpc("prism_leave_team"));
  return ensureMembership();
}

/* ---------- Team & people ---------- */

export const getTeam = async (id: string) =>
  ok<Team>(await db().from("teams").select("id, number, name, created_at").eq("id", id).single());

export const renameTeam = async (id: string, name: string) =>
  ok(await db().from("teams").update({ name: name.trim() || null }).eq("id", id));

export const listMembers = async (teamId: string) =>
  ok<Member[]>(
    await db()
      .from("team_members")
      .select("user_id, team_id, role, status, created_at, profile:profiles(name, email)")
      .eq("team_id", teamId)
      .neq("status", "rejected")
      .order("created_at"),
  );

export const decideMember = async (userId: string, accept: boolean) =>
  ok(await db().rpc("prism_decide_member", { p_user: userId, p_accept: accept }));

export const setRole = async (userId: string, role: Exclude<Role, "owner">) =>
  ok(await db().rpc("prism_set_role", { p_user: userId, p_role: role }));

export const removeMember = async (userId: string) => ok(await db().rpc("prism_remove_member", { p_user: userId }));

export const getProfile = async (userId: string) =>
  ok<Profile>(
    await db().from("profiles").select("user_id, name, email, beta_updates, created_at").eq("user_id", userId).single(),
  );

export const updateProfile = async (userId: string, patch: Partial<Pick<Profile, "name" | "beta_updates">>) =>
  ok(await db().from("profiles").update(patch).eq("user_id", userId));

/* ---------- Devices ---------- */

export async function listDevices(teamId?: string) {
  let q = db().from("devices").select(`${DEVICE_COLS}, team:teams(number)`).order("created_at", { ascending: false });
  if (teamId) q = q.eq("team_id", teamId);
  return ok<Device[]>(await q);
}

export const updateDevice = async (id: string, patch: Partial<Pick<Device, "name" | "status">>) =>
  ok(await db().from("devices").update(patch).eq("id", id));

export const deleteDevice = async (id: string) => ok(await db().from("devices").delete().eq("id", id));

export async function createPairing() {
  const rows = ok<{ code: string; expires_at: string }[]>(await db().rpc("prism_create_pairing"));
  return rows[0];
}

export const pairingStatus = async (code: string) =>
  ok<{ device_id: string | null; device: { name: string } | null }>(
    await db().from("device_pairings").select("device_id, device:devices(name)").eq("code", code).single(),
  );

export async function claimPairing(code: string, name: string, kind: DeviceKind, platform: string) {
  const rows = ok<{ device_id: string; team_number: number; device_token: string }[]>(
    await db().rpc("prism_claim_pairing", { p_code: code, p_name: name, p_kind: kind, p_platform: platform }),
  );
  return rows[0];
}

export const deviceStatus = async (token: string) =>
  ok<DeviceStatus | null>(await db().rpc("prism_device_status", { p_token: token }));

export const listAccess = async (deviceId: string) =>
  ok<Access[]>(await db().from("device_access").select("device_id, software_id, channel").eq("device_id", deviceId));

export async function setAccess(deviceId: string, softwareId: string, channel: Channel | null) {
  if (!channel) {
    return ok(await db().from("device_access").delete().eq("device_id", deviceId).eq("software_id", softwareId));
  }
  return ok(
    await db()
      .from("device_access")
      .upsert({ device_id: deviceId, software_id: softwareId, channel }, { onConflict: "device_id,software_id" }),
  );
}

/* ---------- Software ---------- */

export const listSoftware = async () =>
  ok<Software[]>(await db().from("software").select("id, slug, name, description, created_at").order("name"));

export const createSoftware = async (s: Pick<Software, "slug" | "name" | "description">) =>
  ok(await db().from("software").insert(s));

export const deleteSoftware = async (id: string) => ok(await db().from("software").delete().eq("id", id));

export const listReleases = async () =>
  ok<Release[]>(
    await db()
      .from("releases")
      .select("id, software_id, version, channel, notes, download_url, published, created_at")
      .order("created_at", { ascending: false }),
  );

export const createRelease = async (
  r: Pick<Release, "software_id" | "version" | "channel" | "notes" | "download_url" | "published">,
) => ok(await db().from("releases").insert(r));

export const updateRelease = async (id: string, patch: Partial<Pick<Release, "published" | "channel" | "notes">>) =>
  ok(await db().from("releases").update(patch).eq("id", id));

export const deleteRelease = async (id: string) => ok(await db().from("releases").delete().eq("id", id));

/* ---------- Test programs ---------- */

export const listPrograms = async () =>
  ok<Program[]>(
    await db()
      .from("test_programs")
      .select("id, title, description, software_id, status, created_at, software:software(name)")
      .order("created_at", { ascending: false }),
  );

export const createProgram = async (p: Pick<Program, "title" | "description" | "software_id" | "status">) =>
  ok(await db().from("test_programs").insert(p));

export const updateProgram = async (id: string, patch: Partial<Pick<Program, "status">>) =>
  ok(await db().from("test_programs").update(patch).eq("id", id));

export const deleteProgram = async (id: string) => ok(await db().from("test_programs").delete().eq("id", id));

export const listEnrollments = async (teamId?: string) => {
  let q = db().from("program_enrollments").select("program_id, team_id");
  if (teamId) q = q.eq("team_id", teamId);
  return ok<{ program_id: string; team_id: string }[]>(await q);
};

export const enroll = async (programId: string, teamId: string) =>
  ok(await db().from("program_enrollments").insert({ program_id: programId, team_id: teamId }));

export const unenroll = async (programId: string, teamId: string) =>
  ok(await db().from("program_enrollments").delete().eq("program_id", programId).eq("team_id", teamId));

/* ---------- Community ---------- */

export const listPosts = async () =>
  ok<Post[]>(
    await db()
      .from("posts")
      .select("*, votes:post_votes(count)")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
  );

export async function myVotes() {
  const user = await getUser();
  if (!user) return new Set<string>();
  const rows = ok<{ post_id: string }[]>(await db().from("post_votes").select("post_id").eq("user_id", user.id));
  return new Set(rows.map((r) => r.post_id));
}

export const createPost = async (p: Pick<Post, "kind" | "title" | "body">) => ok(await db().from("posts").insert(p));

export async function vote(postId: string, on: boolean) {
  if (on) return ok(await db().from("post_votes").insert({ post_id: postId }));
  const user = await getUser();
  return ok(await db().from("post_votes").delete().eq("post_id", postId).eq("user_id", user?.id ?? ""));
}

export const moderatePost = async (
  id: string,
  patch: Partial<Pick<Post, "status" | "pinned" | "hidden" | "admin_note">>,
) => ok(await db().from("posts").update(patch).eq("id", id));

export const deletePost = async (id: string) => ok(await db().from("posts").delete().eq("id", id));

/* ---------- Website ---------- */

export const getSettings = async () =>
  ok<SiteSettings>(
    await db().from("site_settings").select("announcement, announcement_url, signups_open, updated_at").single(),
  );

export const saveSettings = async (patch: Partial<Omit<SiteSettings, "updated_at">>) =>
  ok(await db().from("site_settings").update(patch).eq("id", true));

/* ---------- Staff overviews ---------- */

export const listTeams = async () =>
  ok<TeamSummary[]>(
    await db()
      .from("teams")
      .select("id, number, name, created_at, team_members(count), devices(count)")
      .order("number"),
  );

export const listProfiles = async () =>
  ok<Profile[]>(
    await db()
      .from("profiles")
      .select("user_id, name, email, beta_updates, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  );

async function count(table: string, column: string, filter?: [string, string]) {
  let q = db().from(table).select(column, { count: "exact", head: true });
  if (filter) q = q.eq(filter[0], filter[1]);
  const { count: n, error } = await q;
  if (error) throw new Error(friendly(error.message));
  return n ?? 0;
}

export async function platformCounts() {
  const [teams, accounts, devices, pending, open] = await Promise.all([
    count("teams", "id"),
    count("profiles", "user_id"),
    count("devices", "id"),
    count("team_members", "user_id", ["status", "pending"]),
    count("posts", "id", ["status", "open"]),
  ]);
  return { teams, accounts, devices, pending, open };
}

export const listPending = async () =>
  ok<(Member & { team: { number: number } | null })[]>(
    await db()
      .from("team_members")
      .select("user_id, team_id, role, status, created_at, profile:profiles(name, email), team:teams(number)")
      .eq("status", "pending")
      .order("created_at"),
  );
