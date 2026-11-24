"use client";

import Link from "next/link";
import { useState } from "react";
import {
  createProgram,
  createRelease,
  createSoftware,
  decideMember,
  deleteProgram,
  deleteRelease,
  deleteSoftware,
  getSettings,
  listEnrollments,
  listPending,
  listPrograms,
  listProfiles,
  listReleases,
  listSoftware,
  listTeams,
  platformCounts,
  saveSettings,
  updateProgram,
  updateRelease,
  type Channel,
  type ProgramStatus,
  type Software,
  type TeamSummary,
} from "@/lib/api";
import { useQuery } from "@/lib/useQuery";
import { useSession, type Session } from "@/lib/useSession";
import { CommunityPanel } from "../console/Community";
import { DevicesPanel } from "../console/Devices";
import { Icon } from "../console/Icon";
import { MembersPanel } from "../console/Members";
import { Gate, Shell, useHashSection, type NavSection } from "../console/Shell";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  ErrorNote,
  Group,
  Loading,
  PageHead,
  Row,
  Section,
  Select,
  Sheet,
  Switch,
  TextArea,
  TextField,
  ago,
  styles as s,
  useAction,
} from "../console/ui";

type Ready = Extract<Session, { kind: "ready" }>;
const IDS = ["overview", "teams", "devices", "software", "testing", "community", "website"] as const;
type Id = (typeof IDS)[number];

/* ---------- Overview ---------- */

function Overview({ go }: { go: (id: Id) => void }) {
  const counts = useQuery(() => platformCounts(), []);
  const pending = useQuery(() => listPending(), []);
  const people = useQuery(() => listProfiles(), []);
  const act = useAction();
  const c = counts.data;
  const n = (v: number | undefined) => (v === undefined ? "–" : v);
  const refresh = () => {
    pending.reload();
    counts.reload();
  };

  return (
    <>
      <PageHead
        title="Prism admin"
        lead={
          <>
            <strong>Team accounts, test devices and beta releases.</strong> Changes here apply to
            the beta portal.
          </>
        }
      />
      <ErrorNote message={counts.error} />
      <Section>
        <div className={s.stats}>
          <button type="button" className={s.stat} onClick={() => go("teams")}>
            <strong>{n(c?.teams)}</strong>
            <span>Teams</span>
          </button>
          <button type="button" className={s.stat} onClick={() => go("teams")}>
            <strong>{n(c?.accounts)}</strong>
            <span>Accounts</span>
          </button>
          <button type="button" className={s.stat} onClick={() => go("devices")}>
            <strong>{n(c?.devices)}</strong>
            <span>Devices</span>
          </button>
          <button type="button" className={s.stat} onClick={() => go("community")}>
            <strong>{n(c?.open)}</strong>
            <span>Open posts</span>
          </button>
        </div>
      </Section>

      <Section title="Waiting to join a team" aside={pending.data?.length ? `${pending.data.length} waiting` : undefined}>
        {!pending.data ? (
          <Loading rows={2} />
        ) : pending.data.length === 0 ? (
          <Empty title="No one is waiting." />
        ) : (
          <Group>
            {pending.data.map((m) => (
              <Row
                key={m.user_id}
                lead={<Avatar name={m.profile?.name} email={m.profile?.email} />}
                title={m.profile?.name || m.profile?.email}
                sub={`Team ${m.team?.number ?? "?"} · ${m.profile?.email ?? ""} · ${ago(m.created_at)}`}
                end={
                  <>
                    <Button variant="danger" size="small" onClick={() => act(() => decideMember(m.user_id, false), "Declined").then(refresh)}>
                      Decline
                    </Button>
                    <Button variant="primary" size="small" onClick={() => act(() => decideMember(m.user_id, true), "Accepted").then(refresh)}>
                      Accept
                    </Button>
                  </>
                }
              />
            ))}
          </Group>
        )}
        <p className={s.note}>Teams normally accept their own people. Step in here when a team has no active admin.</p>
      </Section>

      <Section title="Newest accounts">
        {!people.data ? (
          <Loading rows={3} />
        ) : (
          <Group>
            {people.data.slice(0, 8).map((p) => (
              <Row
                key={p.user_id}
                lead={<Avatar name={p.name} email={p.email} />}
                title={p.name || p.email}
                sub={p.email}
                end={<span className={s.rowSub}>{ago(p.created_at)}</span>}
              />
            ))}
          </Group>
        )}
      </Section>
    </>
  );
}

/* ---------- Teams ---------- */

function Teams({ selfId }: { selfId: string }) {
  const teams = useQuery(() => listTeams(), []);
  const [open, setOpen] = useState<TeamSummary | null>(null);

  return (
    <>
      <PageHead title="Teams" lead={<><strong>Every team on Prism and who&apos;s in it.</strong> Open a team to manage its people and devices.</>} />
      <Section aside={teams.data ? `${teams.data.length} teams` : undefined} title="All teams">
        {!teams.data ? (
          teams.error ? <ErrorNote message={teams.error} /> : <Loading />
        ) : (
          <Group>
            {teams.data.map((t) => (
              <Row
                key={t.id}
                lead={<Icon name="teams" />}
                title={`Team ${t.number}${t.name ? ` · ${t.name}` : ""}`}
                sub={`${t.team_members[0]?.count ?? 0} accounts · ${t.devices[0]?.count ?? 0} devices · since ${new Date(t.created_at).toLocaleDateString()}`}
                onClick={() => setOpen(t)}
              />
            ))}
          </Group>
        )}
      </Section>
      <Sheet open={Boolean(open)} onClose={() => setOpen(null)} title={open ? `Team ${open.number}` : ""}>
        {open && (
          <>
            <MembersPanel teamId={open.id} canManage selfId={selfId} onChange={teams.reload} />
            <DevicesPanel teamId={open.id} canManage canAdd={false} />
          </>
        )}
      </Sheet>
    </>
  );
}

/* ---------- Software & releases ---------- */

function NewSoftwareSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const act = useAction();
  const autoSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (
    <Sheet open={open} onClose={onClose} title="New software.">
      <form
        className={s.form}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act(() => createSoftware({ name: name.trim(), slug: autoSlug, description: description.trim() || null }), "Software added")) {
            setName("");
            setSlug("");
            setDescription("");
            onDone();
            onClose();
          }
        }}
      >
        <TextField label="Name" value={name} maxLength={60} required placeholder="Prism Scout" onChange={(e) => setName(e.target.value)} />
        <TextField label="Short ID" value={autoSlug} pattern="[a-z0-9-]{2,40}" onChange={(e) => setSlug(e.target.value)} />
        <TextArea label="Description" value={description} maxLength={400} onChange={(e) => setDescription(e.target.value)} />
        <div className={s.actions}>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Add software
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function NewReleaseSheet({
  software,
  open,
  onClose,
  onDone,
}: {
  software: Software[];
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [softwareId, setSoftwareId] = useState("");
  const [version, setVersion] = useState("");
  const [channel, setChannel] = useState<Channel>("beta");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [published, setPublished] = useState(false);
  const act = useAction();
  const target = softwareId || software[0]?.id || "";

  return (
    <Sheet open={open} onClose={onClose} title="New release.">
      <form
        className={s.form}
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await act(
            () =>
              createRelease({
                software_id: target,
                version: version.trim(),
                channel,
                notes: notes.trim() || null,
                download_url: url.trim() || null,
                published,
              }),
            published ? "Release published" : "Draft release saved",
          );
          if (ok) {
            setVersion("");
            setNotes("");
            setUrl("");
            setPublished(false);
            onDone();
            onClose();
          }
        }}
      >
        <div className={s.formRow}>
          <label className={s.field}>
            <span>Software</span>
            <Select value={target} onChange={(e) => setSoftwareId(e.target.value)} style={{ height: 44 }}>
              {software.map((sw) => (
                <option key={sw.id} value={sw.id}>
                  {sw.name}
                </option>
              ))}
            </Select>
          </label>
          <TextField label="Version" value={version} required maxLength={40} placeholder="0.4.0" onChange={(e) => setVersion(e.target.value)} />
        </div>
        <label className={s.field}>
          <span>Channel</span>
          <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} style={{ height: 44 }}>
            <option value="beta">Beta: devices on the beta channel get it</option>
            <option value="stable">Stable: every device with access gets it</option>
          </Select>
        </label>
        <TextField label="Download link" type="url" value={url} placeholder="https://github.com/…/releases/download/…" onChange={(e) => setUrl(e.target.value)} />
        <TextArea label="Release notes" value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} />
        <Group>
          <Row
            title="Publish now"
            sub="Unpublished releases are only visible here."
            end={<Switch label="Publish now" checked={published} onChange={setPublished} />}
          />
        </Group>
        <div className={s.actions}>
          <Button type="submit" variant="primary" disabled={!version.trim() || !target}>
            Save release
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function SoftwareSection() {
  const software = useQuery(() => listSoftware(), []);
  const releases = useQuery(() => listReleases(), []);
  const [adding, setAdding] = useState<"software" | "release" | null>(null);
  const act = useAction();

  return (
    <>
      <PageHead
        title="Software"
        action={
          <div className={s.actions}>
            <Button onClick={() => setAdding("software")}>New software</Button>
            <Button variant="primary" onClick={() => setAdding("release")} disabled={!software.data?.length}>
              <Icon name="plus" size={16} />
              New release
            </Button>
          </div>
        }
        lead={<><strong>Test software managed by the beta portal.</strong> Teams grant each device access to software; releases decide what it downloads.</>}
      />
      {!software.data || !releases.data ? (
        <Section>
          {software.error || releases.error ? <ErrorNote message={software.error || releases.error} /> : <Loading />}
        </Section>
      ) : software.data.length === 0 ? (
        <Section>
          <Empty title="No software yet." />
        </Section>
      ) : (
        software.data.map((sw) => {
          const rel = releases.data!.filter((r) => r.software_id === sw.id);
          return (
            <Section
              key={sw.id}
              title={sw.name}
              aside={
                <Button
                  variant="danger"
                  size="small"
                  onClick={async () => {
                    if (!window.confirm(`Delete ${sw.name} and all its releases? Devices lose access to it.`)) return;
                    if (await act(() => deleteSoftware(sw.id), "Software deleted")) {
                      software.reload();
                      releases.reload();
                    }
                  }}
                >
                  Delete
                </Button>
              }
            >
              {sw.description && <p className={s.note} style={{ marginTop: -6, marginBottom: 12 }}>{sw.description}</p>}
              {rel.length === 0 ? (
                <Empty title="No releases yet." />
              ) : (
                <Group>
                  {rel.map((r) => (
                    <Row
                      key={r.id}
                      title={
                        <>
                          {r.version} <Badge tone={r.channel === "stable" ? "green" : "orange"}>{r.channel === "stable" ? "Stable" : "Beta"}</Badge>
                        </>
                      }
                      sub={[r.notes, ago(r.created_at)].filter(Boolean).join(" · ")}
                      end={
                        <>
                          {r.download_url && (
                            <a className={`${s.btn} ${s.plain} ${s.small}`} href={r.download_url}>
                              Download
                            </a>
                          )}
                          <Button
                            variant="danger"
                            size="small"
                            onClick={async () => {
                              if (!window.confirm(`Delete ${sw.name} ${r.version}?`)) return;
                              if (await act(() => deleteRelease(r.id), "Release deleted")) releases.reload();
                            }}
                          >
                            Delete
                          </Button>
                          <Switch
                            label={`Publish ${sw.name} ${r.version}`}
                            checked={r.published}
                            onChange={async (v) => {
                              if (await act(() => updateRelease(r.id, { published: v }), v ? "Published" : "Unpublished")) releases.reload();
                            }}
                          />
                        </>
                      }
                    />
                  ))}
                </Group>
              )}
            </Section>
          );
        })
      )}
      <NewSoftwareSheet open={adding === "software"} onClose={() => setAdding(null)} onDone={software.reload} />
      <NewReleaseSheet
        software={software.data ?? []}
        open={adding === "release"}
        onClose={() => setAdding(null)}
        onDone={releases.reload}
      />
    </>
  );
}

/* ---------- Test programs ---------- */

function TestingSection() {
  const programs = useQuery(() => listPrograms(), []);
  const software = useQuery(() => listSoftware(), []);
  const enrollments = useQuery(() => listEnrollments(), []);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [softwareId, setSoftwareId] = useState("");
  const [status, setStatus] = useState<ProgramStatus>("open");
  const act = useAction();

  const counts = new Map<string, number>();
  for (const e of enrollments.data ?? []) counts.set(e.program_id, (counts.get(e.program_id) ?? 0) + 1);

  return (
    <>
      <PageHead
        title="Testing"
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} />
            New program
          </Button>
        }
        lead={<><strong>Programs teams can join to try things early.</strong> Drafts stay hidden until you open them.</>}
      />
      <Section>
        {!programs.data ? (
          programs.error ? <ErrorNote message={programs.error} /> : <Loading />
        ) : programs.data.length === 0 ? (
          <Empty title="No test programs yet." />
        ) : (
          <Group>
            {programs.data.map((p) => (
              <Row
                key={p.id}
                title={p.title}
                sub={[`${counts.get(p.id) ?? 0} teams joined`, p.software?.name, p.description].filter(Boolean).join(" · ")}
                end={
                  <>
                    <Select
                      aria-label={`Status of ${p.title}`}
                      value={p.status}
                      onChange={async (e) => {
                        if (await act(() => updateProgram(p.id, { status: e.target.value as ProgramStatus }), "Program updated"))
                          programs.reload();
                      }}
                    >
                      <option value="draft">Draft</option>
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                    </Select>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={async () => {
                        if (!window.confirm(`Delete "${p.title}"?`)) return;
                        if (await act(() => deleteProgram(p.id), "Program deleted")) programs.reload();
                      }}
                    >
                      Delete
                    </Button>
                  </>
                }
              />
            ))}
          </Group>
        )}
      </Section>
      <Sheet open={adding} onClose={() => setAdding(false)} title="New test program.">
        <form
          className={s.form}
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await act(
              () => createProgram({ title: title.trim(), description: description.trim(), software_id: softwareId || null, status }),
              "Program created",
            );
            if (ok) {
              setTitle("");
              setDescription("");
              setAdding(false);
              programs.reload();
            }
          }}
        >
          <TextField label="Title" value={title} minLength={3} maxLength={100} required placeholder="Offline sync for Pi Zero" onChange={(e) => setTitle(e.target.value)} />
          <TextArea label="What teams should test" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
          <div className={s.formRow}>
            <label className={s.field}>
              <span>Software</span>
              <Select value={softwareId} onChange={(e) => setSoftwareId(e.target.value)} style={{ height: 44 }}>
                <option value="">None</option>
                {(software.data ?? []).map((sw) => (
                  <option key={sw.id} value={sw.id}>
                    {sw.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className={s.field}>
              <span>Status</span>
              <Select value={status} onChange={(e) => setStatus(e.target.value as ProgramStatus)} style={{ height: 44 }}>
                <option value="open">Open to teams</option>
                <option value="draft">Draft</option>
              </Select>
            </label>
          </div>
          <div className={s.actions}>
            <Button type="submit" variant="primary" disabled={title.trim().length < 3}>
              Create program
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

/* ---------- Website ---------- */

function Website() {
  const settings = useQuery(() => getSettings(), []);
  const [text, setText] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const act = useAction();
  const d = settings.data;
  const currentText = text ?? d?.announcement ?? "";
  const currentUrl = url ?? d?.announcement_url ?? "";

  return (
    <>
      <PageHead title="Website" lead={<><strong>What visitors see on the public site.</strong> Changes go live as soon as you save.</>} />
      {!d ? (
        <Section>{settings.error ? <ErrorNote message={settings.error} /> : <Loading rows={2} />}</Section>
      ) : (
        <>
          <Section title="Sign-ups">
            <Group>
              <Row
                title="Accept new beta accounts"
                sub={d.signups_open ? "Anyone can create a team or ask to join one." : "New teams and join requests are paused."}
                end={
                  <Switch
                    label="Accept new beta accounts"
                    checked={d.signups_open}
                    onChange={async (v) => {
                      if (await act(() => saveSettings({ signups_open: v }), v ? "Sign-ups open" : "Sign-ups paused")) settings.reload();
                    }}
                  />
                }
              />
            </Group>
          </Section>

          <Section title="Announcement" aside={`Updated ${ago(d.updated_at)}`}>
            <div className={s.group} style={{ padding: 20 }}>
              <form
                className={s.form}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await act(
                    () => saveSettings({ announcement: currentText.trim() || null, announcement_url: currentUrl.trim() || null }),
                    currentText.trim() ? "Announcement live" : "Announcement removed",
                  );
                  if (ok) settings.reload();
                }}
              >
                <TextField
                  label="Text"
                  value={currentText}
                  maxLength={140}
                  placeholder="A new beta build is ready for testing"
                  onChange={(e) => setText(e.target.value)}
                />
                <TextField
                  label="Link (optional)"
                  value={currentUrl}
                  placeholder="/beta or https://…"
                  onChange={(e) => setUrl(e.target.value)}
                />
                <p className={s.note} style={{ marginTop: 0 }}>Shown above the headline on the homepage. Leave the text empty to hide it.</p>
                <div className={s.actions}>
                  <Button type="submit" variant="primary">
                    Save
                  </Button>
                </div>
              </form>
            </div>
          </Section>
        </>
      )}

      <Section title="Pages">
        <Group>
          {[
            ["/", "Homepage"],
            ["/beta", "Beta sign-up"],
            ["/dashboard", "Team dashboard"],
            ["/pair", "Device pairing"],
          ].map(([href, label]) => (
            <Row
              key={href}
              title={label}
              sub={href}
              end={
                <Link href={href} className={`${s.btn} ${s.plain} ${s.small}`}>
                  Open
                </Link>
              }
            />
          ))}
        </Group>
      </Section>
    </>
  );
}

/* ---------- Page ---------- */

function Console({ r }: { r: Ready }) {
  const [active, go] = useHashSection(IDS, "overview");
  const sections: NavSection<Id>[] = [
    { id: "overview", label: "Overview", icon: "overview" },
    { id: "teams", label: "Teams", icon: "teams" },
    { id: "devices", label: "Devices", icon: "devices" },
    { id: "software", label: "Software", icon: "software" },
    { id: "testing", label: "Testing", icon: "testing" },
    { id: "community", label: "Community", icon: "community" },
    { id: "website", label: "Website", icon: "website" },
  ];

  return (
    <Shell
      identity={{ big: "Admin", sub: `Signed in as ${r.user.email}` }}
      sections={sections}
      active={active}
      onSelect={go}
      extraLinks={
        <Link href="/dashboard" className={s.navItem}>
          <Icon name="account" size={18} />
          Team dashboard
        </Link>
      }
    >
      {active === "overview" && <Overview go={go} />}
      {active === "teams" && <Teams selfId={r.user.id} />}
      {active === "devices" && (
        <>
          <PageHead title="Devices" lead={<><strong>Every device paired on Prism.</strong> Revoke anything that shouldn&apos;t be there.</>} />
          <DevicesPanel canManage canAdd={false} showTeam />
        </>
      )}
      {active === "software" && <SoftwareSection />}
      {active === "testing" && <TestingSection />}
      {active === "community" && (
        <>
          <PageHead title="Community" lead={<><strong>Suggestions, bugs and questions from every team.</strong> Set a status, pin, respond or hide.</>} />
          <CommunityPanel canPost moderate />
        </>
      )}
      {active === "website" && <Website />}
    </Shell>
  );
}

export default function Admin() {
  const { session, reload } = useSession();
  return (
    <Gate session={session} reload={reload} next="/admin">
      {(r) =>
        r.isStaff ? (
          <Console r={r} />
        ) : (
          <div className={s.root}>
            <div className={s.center}>
              <div className={s.card}>
                <h1>This area is for the Prism team.</h1>
                <p className={s.lead}>Your team&apos;s tools are on the dashboard.</p>
                <div className={s.actions}>
                  <Link href="/dashboard" className={`${s.btn} ${s.primary}`}>
                    Open dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </Gate>
  );
}
