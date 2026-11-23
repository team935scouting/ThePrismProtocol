"use client";

import { decideMember, listMembers, removeMember, setRole, type Member, type Role } from "@/lib/api";
import { useQuery } from "@/lib/useQuery";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  ErrorNote,
  Group,
  Loading,
  Row,
  Section,
  Select,
  ago,
  styles as s,
  useAction,
} from "./ui";

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", developer: "Developer" };

/** Join requests and the member list for one team. Used by the dashboard and by staff. */
export function MembersPanel({
  teamId,
  canManage,
  selfId,
  onChange,
}: {
  teamId: string;
  canManage: boolean;
  selfId: string;
  onChange?: () => void;
}) {
  const { data, error, loading, reload } = useQuery(() => listMembers(teamId), [teamId]);
  const act = useAction();
  const done = () => {
    reload();
    onChange?.();
  };

  if (!data) return error ? <ErrorNote message={error} /> : <Loading />;

  const pending = data.filter((m) => m.status === "pending");
  const active = data.filter((m) => m.status === "active");
  const order: Record<Role, number> = { owner: 0, admin: 1, developer: 2 };
  active.sort((a, b) => order[a.role] - order[b.role]);

  const name = (m: Member) => m.profile?.name || m.profile?.email || "Unknown account";

  return (
    <>
      {(pending.length > 0 || canManage) && (
        <Section title="Requests" aside={pending.length ? `${pending.length} waiting` : undefined}>
          {pending.length === 0 ? (
            <Empty title="No one is waiting.">
              People who sign up with this team number show up here for you to accept.
            </Empty>
          ) : (
            <Group>
              {pending.map((m) => (
                <Row
                  key={m.user_id}
                  lead={<Avatar name={m.profile?.name} email={m.profile?.email} />}
                  title={name(m)}
                  sub={`${m.profile?.email ?? ""} · asked ${ago(m.created_at)}`}
                  end={
                    canManage ? (
                      <>
                        <Button
                          variant="danger"
                          size="small"
                          disabled={loading}
                          onClick={() => act(() => decideMember(m.user_id, false), "Request declined").then(done)}
                        >
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          size="small"
                          disabled={loading}
                          onClick={() => act(() => decideMember(m.user_id, true), `${name(m)} joined as a developer`).then(done)}
                        >
                          Accept
                        </Button>
                      </>
                    ) : (
                      <Badge tone="orange">Waiting</Badge>
                    )
                  }
                />
              ))}
            </Group>
          )}
        </Section>
      )}

      <Section title="Team" aside={`${active.length} ${active.length === 1 ? "person" : "people"}`}>
        <Group>
          {active.map((m) => {
            const self = m.user_id === selfId;
            const editable = canManage && !self && m.role !== "owner";
            return (
              <Row
                key={m.user_id}
                lead={<Avatar name={m.profile?.name} email={m.profile?.email} />}
                title={
                  <>
                    {name(m)}
                    {self && <span style={{ fontWeight: 400, color: "var(--c-muted)" }}> (you)</span>}
                  </>
                }
                sub={m.profile?.email}
                end={
                  editable ? (
                    <>
                      <Select
                        aria-label={`Role for ${name(m)}`}
                        value={m.role}
                        disabled={loading}
                        onChange={(e) =>
                          act(
                            () => setRole(m.user_id, e.target.value as Exclude<Role, "owner">),
                            `${name(m)} is now ${e.target.value === "admin" ? "an admin" : "a developer"}`,
                          ).then(done)
                        }
                      >
                        <option value="developer">Developer</option>
                        <option value="admin">Admin</option>
                      </Select>
                      <Button
                        variant="danger"
                        size="small"
                        disabled={loading}
                        onClick={() => {
                          if (window.confirm(`Remove ${name(m)} from the team?`)) {
                            act(() => removeMember(m.user_id), "Removed from team").then(done);
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Badge tone={m.role === "owner" ? "blue" : m.role === "admin" ? "green" : undefined}>
                      {ROLE_LABEL[m.role]}
                    </Badge>
                  )
                }
              />
            );
          })}
        </Group>
        <p className={s.note}>
          Developers can register devices and post in the community. Admins can also accept people,
          change roles and manage devices and software access.
        </p>
      </Section>
    </>
  );
}
