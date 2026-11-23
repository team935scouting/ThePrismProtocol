"use client";

import Link from "next/link";
import { useState } from "react";
import {
  enroll,
  getProfile,
  listDevices,
  listEnrollments,
  listMembers,
  listPrograms,
  renameTeam,
  unenroll,
  updateProfile,
  type Role,
} from "@/lib/api";
import { useQuery } from "@/lib/useQuery";
import { useSession, type Session } from "@/lib/useSession";
import { CommunityPanel } from "../console/Community";
import { DevicesPanel } from "../console/Devices";
import { Icon } from "../console/Icon";
import { MembersPanel } from "../console/Members";
import { Gate, Shell, useHashSection, type NavSection } from "../console/Shell";
import {
  Badge,
  Button,
  Empty,
  ErrorNote,
  Group,
  Loading,
  PageHead,
  Row,
  Section,
  Switch,
  TextField,
  styles as s,
  useAction,
} from "../console/ui";

type Ready = Extract<Session, { kind: "ready" }>;
const IDS = ["overview", "members", "devices", "testing", "community", "account"] as const;
type Id = (typeof IDS)[number];

const ROLE_SENTENCE: Record<Role, string> = {
  owner: "You own this team.",
  admin: "You're an admin on this team.",
  developer: "You're a developer on this team.",
};

const teamTitle = (r: Ready) => (r.team.name ? `${r.team.name}` : `Team ${r.team.number}`);

/* ---------- Overview ---------- */

function Overview({ r, go }: { r: Ready; go: (id: Id) => void }) {
  const members = useQuery(() => listMembers(r.team.id), [r.team.id]);
  const devices = useQuery(() => listDevices(r.team.id), [r.team.id]);
  const enrollments = useQuery(() => listEnrollments(r.team.id), [r.team.id]);

  const active = members.data?.filter((m) => m.status === "active").length;
  const pending = members.data?.filter((m) => m.status === "pending") ?? [];
  const stat = (v: number | undefined) => (v === undefined ? "–" : v);

  return (
    <>
      <PageHead
        title={teamTitle(r)}
        lead={
          <>
            <strong>{ROLE_SENTENCE[r.membership.role]}</strong>{" "}
            {r.team.name ? `Team ${r.team.number}. ` : ""}Everything your team runs on Prism is here.
          </>
        }
      />
      <Section>
        <div className={s.stats}>
          <button type="button" className={s.stat} onClick={() => go("members")}>
            <strong>{stat(active)}</strong>
            <span>{active === 1 ? "Member" : "Members"}</span>
          </button>
          <button type="button" className={s.stat} onClick={() => go("members")}>
            <strong>{members.data ? pending.length : "–"}</strong>
            <span>Waiting to join</span>
          </button>
          <button type="button" className={s.stat} onClick={() => go("devices")}>
            <strong>{stat(devices.data?.length)}</strong>
            <span>Devices</span>
          </button>
          <button type="button" className={s.stat} onClick={() => go("testing")}>
            <strong>{stat(enrollments.data?.length)}</strong>
            <span>Test programs</span>
          </button>
        </div>
      </Section>

      {r.isManager && pending.length > 0 && (
        <Section title="Needs your attention">
          <Group>
            <Row
              title={`${pending.length} ${pending.length === 1 ? "person wants" : "people want"} to join`}
              sub={pending.map((m) => m.profile?.name || m.profile?.email).join(", ")}
              onClick={() => go("members")}
            />
          </Group>
        </Section>
      )}

      <Section title="Get set up">
        <Group>
          <Row
            lead={<Icon name="members" />}
            title="Invite your developers"
            sub={`They sign up at ${typeof window === "undefined" ? "" : window.location.host}/beta with team number ${r.team.number}.`}
          />
          <Row
            lead={<Icon name="devices" />}
            title="Pair your scouting devices"
            sub="Each phone or tablet scans a code once."
            onClick={() => go("devices")}
          />
          <Row
            lead={<Icon name="testing" />}
            title="Try what's in testing"
            sub="Join test programs before features ship."
            onClick={() => go("testing")}
          />
        </Group>
      </Section>
    </>
  );
}

/* ---------- Testing ---------- */

function Testing({ r }: { r: Ready }) {
  const programs = useQuery(() => listPrograms(), []);
  const enrollments = useQuery(() => listEnrollments(r.team.id), [r.team.id]);
  const act = useAction();
  const joined = new Set((enrollments.data ?? []).map((e) => e.program_id));
  const visible = (programs.data ?? []).filter((p) => p.status !== "draft");

  return (
    <>
      <PageHead
        title="Testing"
        lead={
          <>
            <strong>Try new Prism features before they ship.</strong> Join a program and its builds and
            settings reach your team first.
          </>
        }
      />
      <Section>
        {!programs.data ? (
          programs.error ? (
            <ErrorNote message={programs.error} />
          ) : (
            <Loading />
          )
        ) : visible.length === 0 ? (
          <Empty title="Nothing in testing right now.">New programs show up here when the Prism team opens them.</Empty>
        ) : (
          <Group>
            {visible.map((p) => {
              const on = joined.has(p.id);
              return (
                <Row
                  key={p.id}
                  title={
                    <>
                      {p.title} {on && <Badge tone="green">Joined</Badge>}
                    </>
                  }
                  sub={[p.software?.name, p.description].filter(Boolean).join(" · ")}
                  end={
                    p.status === "closed" ? (
                      <Badge>Closed</Badge>
                    ) : r.isManager ? (
                      <Button
                        variant={on ? "secondary" : "primary"}
                        size="small"
                        onClick={async () => {
                          const ok = await act(
                            () => (on ? unenroll(p.id, r.team.id) : enroll(p.id, r.team.id)),
                            on ? "Left program" : "Joined program",
                          );
                          if (ok) enrollments.reload();
                        }}
                      >
                        {on ? "Leave" : "Join"}
                      </Button>
                    ) : null
                  }
                />
              );
            })}
          </Group>
        )}
        {!r.isManager && <p className={s.note}>Team owners and admins choose which programs to join.</p>}
      </Section>
    </>
  );
}

/* ---------- Account ---------- */

function Account({ r, onTeamChanged }: { r: Ready; onTeamChanged: () => void }) {
  const profile = useQuery(() => getProfile(r.user.id), [r.user.id]);
  const [name, setName] = useState<string | null>(null);
  const [teamName, setTeamName] = useState(r.team.name ?? "");
  const act = useAction();
  const currentName = name ?? profile.data?.name ?? "";

  return (
    <>
      <PageHead title="Account" lead={<><strong>{r.user.email}</strong></>} />

      <Section title="Profile">
        {!profile.data ? (
          <Loading rows={2} />
        ) : (
          <div className={s.group} style={{ padding: 20 }}>
            <form
              className={s.form}
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act(() => updateProfile(r.user.id, { name: currentName.trim() }), "Name saved")) profile.reload();
              }}
            >
              <TextField label="Name" value={currentName} maxLength={80} onChange={(e) => setName(e.target.value)} />
              <div className={s.actions}>
                <Button type="submit" variant="primary" disabled={currentName.trim() === profile.data.name}>
                  Save
                </Button>
              </div>
            </form>
          </div>
        )}
      </Section>

      <Section title="Notifications">
        <Group>
          <Row
            title="Beta build emails"
            sub="Get an email when a new Prism OS build is ready."
            end={
              <Switch
                label="Beta build emails"
                checked={profile.data?.beta_updates ?? false}
                disabled={!profile.data}
                onChange={async (v) => {
                  if (await act(() => updateProfile(r.user.id, { beta_updates: v }), v ? "You'll get build emails" : "Build emails off"))
                    profile.reload();
                }}
              />
            }
          />
        </Group>
      </Section>

      <Section title="Team">
        <Group>
          <Row title="Team number" end={<span className={s.rowSub}>{r.team.number}</span>} />
          <Row title="Your role" end={<Badge tone="blue">{r.membership.role[0].toUpperCase() + r.membership.role.slice(1)}</Badge>} />
        </Group>
        {r.isManager && (
          <div className={s.group} style={{ padding: 20, marginTop: 12 }}>
            <form
              className={s.form}
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act(() => renameTeam(r.team.id, teamName), "Team name saved")) onTeamChanged();
              }}
            >
              <TextField
                label="Team name"
                value={teamName}
                maxLength={80}
                placeholder={`Team ${r.team.number}`}
                onChange={(e) => setTeamName(e.target.value)}
              />
              <div className={s.actions}>
                <Button type="submit" variant="primary" disabled={teamName.trim() === (r.team.name ?? "")}>
                  Save
                </Button>
              </div>
            </form>
          </div>
        )}
      </Section>
    </>
  );
}

/* ---------- Page ---------- */

function Console({ r, reload }: { r: Ready; reload: () => void }) {
  const [active, go] = useHashSection(IDS, "overview");
  const members = useQuery(() => listMembers(r.team.id), [r.team.id, active]);
  const waiting = r.isManager ? members.data?.filter((m) => m.status === "pending").length : 0;

  const sections: NavSection<Id>[] = [
    { id: "overview", label: "Overview", icon: "overview" },
    { id: "members", label: "Members", icon: "members", count: waiting || undefined },
    { id: "devices", label: "Devices", icon: "devices" },
    { id: "testing", label: "Testing", icon: "testing" },
    { id: "community", label: "Community", icon: "community" },
    { id: "account", label: "Account", icon: "account" },
  ];

  return (
    <Shell
      identity={{ big: teamTitle(r), sub: `Team ${r.team.number} · ${r.membership.role}` }}
      sections={sections}
      active={active}
      onSelect={go}
      extraLinks={
        r.isStaff ? (
          <Link href="/admin" className={s.navItem}>
            <Icon name="teams" size={18} />
            Prism admin
          </Link>
        ) : null
      }
    >
      {active === "overview" && <Overview r={r} go={go} />}
      {active === "members" && (
        <>
          <PageHead
            title="Members"
            lead={
              <>
                <strong>Who can work on Team {r.team.number}&apos;s Prism setup.</strong> New sign-ups
                join as developers once accepted.
              </>
            }
          />
          <MembersPanel teamId={r.team.id} canManage={r.isManager} selfId={r.user.id} onChange={members.reload} />
        </>
      )}
      {active === "devices" && (
        <>
          <PageHead
            title="Devices"
            lead={
              <>
                <strong>Every phone, tablet and Pi your team uses.</strong> Choose what software each one
                is allowed to run.
              </>
            }
          />
          <DevicesPanel teamId={r.team.id} canManage={r.isManager} canAdd />
        </>
      )}
      {active === "testing" && <Testing r={r} />}
      {active === "community" && (
        <>
          <PageHead
            title="Community"
            lead={
              <>
                <strong>Tell us what to build next.</strong> Vote on ideas from other teams, report bugs
                and ask questions.
              </>
            }
          />
          <CommunityPanel canPost />
        </>
      )}
      {active === "account" && <Account r={r} onTeamChanged={reload} />}
    </Shell>
  );
}

export default function Dashboard() {
  const { session, reload } = useSession();
  return (
    <Gate session={session} reload={reload} next="/dashboard">
      {(r) => <Console r={r} reload={reload} />}
    </Gate>
  );
}
