"use client";

import { useState } from "react";
import {
  createPost,
  deletePost,
  listPosts,
  moderatePost,
  myVotes,
  vote,
  type Post,
  type PostKind,
  type PostStatus,
} from "@/lib/api";
import { useQuery } from "@/lib/useQuery";
import { Icon } from "./Icon";
import {
  Badge,
  Button,
  Empty,
  ErrorNote,
  Group,
  Loading,
  Section,
  Select,
  Sheet,
  Switch,
  TextArea,
  TextField,
  ago,
  styles as s,
  useAction,
} from "./ui";

export const KIND: Record<PostKind, string> = { suggestion: "Suggestion", bug: "Bug", question: "Question" };
export const STATUS: Record<PostStatus, { label: string; tone?: "green" | "orange" | "blue" | "red" }> = {
  open: { label: "Open" },
  planned: { label: "Planned", tone: "blue" },
  in_progress: { label: "In progress", tone: "orange" },
  done: { label: "Done", tone: "green" },
  declined: { label: "Declined", tone: "red" },
};

function Composer({ onPosted }: { onPosted: () => void }) {
  const [kind, setKind] = useState<PostKind>("suggestion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const act = useAction();

  return (
    <form
      className={s.form}
      onSubmit={async (e) => {
        e.preventDefault();
        if (await act(() => createPost({ kind, title: title.trim(), body: body.trim() }), "Posted")) {
          setTitle("");
          setBody("");
          onPosted();
        }
      }}
    >
      <div className={s.formRow}>
        <TextField
          label="Title"
          value={title}
          minLength={3}
          maxLength={120}
          required
          placeholder="Let the Pi push match schedules"
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className={s.field}>
          <span>Type</span>
          <Select value={kind} onChange={(e) => setKind(e.target.value as PostKind)} style={{ height: 44 }}>
            <option value="suggestion">Suggestion</option>
            <option value="bug">Bug</option>
            <option value="question">Question</option>
          </Select>
        </label>
      </div>
      <TextArea
        label="Details"
        value={body}
        maxLength={4000}
        placeholder="What happened, or what would help, and at what kind of event."
        onChange={(e) => setBody(e.target.value)}
      />
      <div className={s.actions}>
        <Button type="submit" variant="primary" disabled={title.trim().length < 3}>
          Post
        </Button>
      </div>
    </form>
  );
}

function ModerateSheet({ post, onClose, onChanged }: { post: Post | null; onClose: () => void; onChanged: () => void }) {
  const [note, setNote] = useState(post?.admin_note ?? "");
  const act = useAction();
  if (!post) return null;
  const update = async (patch: Parameters<typeof moderatePost>[1], done: string) => {
    if (await act(() => moderatePost(post.id, patch), done)) onChanged();
  };
  return (
    <Sheet open onClose={onClose} title={post.title}>
      <div style={{ display: "grid", gap: 20 }}>
        <p className={s.postBody}>{post.body || "No details."}</p>
        <Group>
          <div className={s.row}>
            <div className={s.rowMain}>
              <div className={s.rowTitle}>Status</div>
            </div>
            <Select
              aria-label="Status"
              value={post.status}
              onChange={(e) => update({ status: e.target.value as PostStatus }, "Status updated")}
            >
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
          <div className={s.row}>
            <div className={s.rowMain}>
              <div className={s.rowTitle}>Pinned</div>
              <div className={s.rowSub}>Shown above everything else.</div>
            </div>
            <Switch label="Pinned" checked={post.pinned} onChange={(v) => update({ pinned: v }, v ? "Pinned" : "Unpinned")} />
          </div>
          <div className={s.row}>
            <div className={s.rowMain}>
              <div className={s.rowTitle}>Hidden</div>
              <div className={s.rowSub}>Only staff and the author can see it.</div>
            </div>
            <Switch label="Hidden" checked={post.hidden} onChange={(v) => update({ hidden: v }, v ? "Hidden" : "Visible again")} />
          </div>
        </Group>
        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            update({ admin_note: note.trim() || null }, "Response saved");
          }}
        >
          <TextArea
            label="Response from Prism"
            value={note}
            maxLength={2000}
            placeholder="Shown under the post for everyone."
            onChange={(e) => setNote(e.target.value)}
          />
          <div className={s.actions} style={{ justifyContent: "space-between" }}>
            <Button
              variant="danger"
              onClick={async () => {
                if (!window.confirm("Delete this post for everyone?")) return;
                if (await act(() => deletePost(post.id), "Post deleted")) {
                  onChanged();
                  onClose();
                }
              }}
            >
              Delete post
            </Button>
            <Button type="submit" variant="primary">
              Save response
            </Button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}

export function CommunityPanel({ canPost, moderate }: { canPost: boolean; moderate?: boolean }) {
  const posts = useQuery(() => listPosts(), []);
  const votes = useQuery(() => myVotes(), []);
  const [filter, setFilter] = useState<"all" | PostKind>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const act = useAction();

  const list = (posts.data ?? [])
    .filter((p) => filter === "all" || p.kind === filter)
    .map((p) => ({ ...p, count: p.votes?.[0]?.count ?? 0 }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.count - a.count);
  const open = posts.data?.find((p) => p.id === openId) ?? null;

  return (
    <>
      {canPost && (
        <Section title="Share something">
          <div className={s.group} style={{ padding: 20 }}>
            <Composer onPosted={posts.reload} />
          </div>
        </Section>
      )}

      <Section
        title={moderate ? "All posts" : "From the community"}
        aside={
          <Select aria-label="Filter posts" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">Everything</option>
            <option value="suggestion">Suggestions</option>
            <option value="bug">Bugs</option>
            <option value="question">Questions</option>
          </Select>
        }
      >
        {!posts.data ? (
          posts.error ? (
            <ErrorNote message={posts.error} />
          ) : (
            <Loading />
          )
        ) : list.length === 0 ? (
          <Empty title="Nothing here yet.">
            {canPost ? "Suggestions, bugs and questions from every team show up here." : undefined}
          </Empty>
        ) : (
          <Group>
            {list.map((p) => {
              const mine = votes.data?.has(p.id) ?? false;
              return (
                <article key={p.id} className={s.post}>
                  <button
                    type="button"
                    className={s.voteBtn}
                    aria-pressed={mine}
                    aria-label={`${mine ? "Remove vote from" : "Vote for"} ${p.title}, ${p.count} votes`}
                    disabled={!canPost}
                    onClick={async () => {
                      if (await act(() => vote(p.id, !mine))) {
                        posts.reload();
                        votes.reload();
                      }
                    }}
                  >
                    <Icon name="vote" size={16} />
                    {p.count}
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <div className={s.rowTitle} style={{ whiteSpace: "normal" }}>
                      {p.pinned && <Icon name="pin" size={14} />} {p.title}
                    </div>
                    {p.body && <p className={s.postBody}>{p.body}</p>}
                    {p.admin_note && (
                      <div className={s.response}>
                        <b>Response from Prism</b>
                        {p.admin_note}
                      </div>
                    )}
                    <div className={s.postMeta}>
                      <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                      <span>{KIND[p.kind]}</span>
                      <span>
                        {p.author_name || "Someone"}
                        {p.team_number ? `, Team ${p.team_number}` : ""} · {ago(p.created_at)}
                      </span>
                      {p.hidden && <Badge tone="red">Hidden</Badge>}
                      {moderate && (
                        <Button variant="plain" size="small" onClick={() => setOpenId(p.id)}>
                          Manage
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </Group>
        )}
      </Section>

      {moderate && (
        <ModerateSheet key={openId ?? "none"} post={open} onClose={() => setOpenId(null)} onChanged={posts.reload} />
      )}
    </>
  );
}
