"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CircleAlert, Send, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  Badge, Button, ErrorNote, Input, Menu, MenuItem, Modal, Spinner, Tabs, Textarea, Toggle,
} from "@/components/ui";
import { SequenceCanvas } from "@/components/sequences/SequenceCanvas";
import { SequenceSettings } from "@/components/sequences/SequenceSettings";
import { RecipientsList } from "@/components/sequences/RecipientsTable";
import { EnrollDialog } from "@/components/sequences/EnrollDialog";
import { api } from "@/lib/api";
import { useAction, useInterval, useQuery } from "@/lib/hooks";
import { toSequenceInput, validateSequence } from "@/lib/drafts";
import { pluralize } from "@/lib/format";
import type { Sequence, SequenceInput } from "@/lib/types";

type Panel = "settings" | "recipients";

export default function SequenceEditorPage() {
  const { id } = useParams<{ id: string }>();

  const sequence = useQuery(() => api.sequences.get(id), [id]);
  const enrollments = useQuery(() => api.sequences.enrollments(id), [id]);
  const stats = useQuery(() => api.sequences.stats(id), [id]);
  const people = useQuery(() => api.people.list(), []);

  const [draft, setDraft] = useState<SequenceInput>();
  const [panel, setPanel] = useState<Panel>("settings");
  const [enrolling, setEnrolling] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const { run, pending, error } = useAction();

  // Load the server copy into the draft once, and after every publish.
  useEffect(() => {
    if (sequence.data && !draft) setDraft(toSequenceInput(sequence.data));
  }, [sequence.data, draft]);

  // Recipients move on their own (the runner ticks every 30s, or 2s in demo mode).
  useInterval(
    () => {
      void enrollments.refresh();
      void stats.refresh();
    },
    5000,
    panel === "recipients",
  );

  const published = sequence.data ? toSequenceInput(sequence.data) : undefined;
  const dirty = useMemo(
    () => Boolean(draft && published) && JSON.stringify(draft) !== JSON.stringify(published),
    [draft, published],
  );

  const problems = useMemo(() => (draft ? validateSequence(draft) : []), [draft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const peopleById = useMemo(
    () => new Map((people.data ?? []).map((p) => [p.id, p])),
    [people.data],
  );
  const sequencesById = useMemo(
    () => new Map(sequence.data ? [[sequence.data.id, sequence.data] as [string, Sequence]] : []),
    [sequence.data],
  );

  const publish = async () => {
    if (!draft) return;
    const saved = await run(() => api.sequences.update(id, draft));
    if (saved) {
      sequence.set(saved);
      setDraft(toSequenceInput(saved));
    }
  };

  const discard = () => sequence.data && setDraft(toSequenceInput(sequence.data));

  const applyEnabled = async (enabled: boolean) => {
    const saved = await run(() => api.sequences.setEnabled(id, enabled));
    if (saved) {
      sequence.set(saved);
      setDraft((d) => (d ? { ...d, enabled } : d));
    }
    return Boolean(saved);
  };

  /**
   * Attio asks what to do with the people still in a sequence when you switch it off,
   * because leaving them enrolled means they resume the moment it is switched back on.
   */
  const setEnabled = async (enabled: boolean) => {
    const stillActive = (enrollments.data ?? []).filter((e) => e.status === "active").length;
    if (!enabled && stillActive > 0) {
      setConfirmDisable(true);
      return;
    }
    await applyEnabled(enabled);
  };

  const disableAndExit = async (exitEveryone: boolean) => {
    const ok = await applyEnabled(false);
    if (ok && exitEveryone) {
      const active = (enrollments.data ?? []).filter((e) => e.status === "active");
      await run(async () => {
        for (const e of active) await api.enrollments.remove(e.id);
        return true;
      });
      void enrollments.refresh();
      void stats.refresh();
    }
    setConfirmDisable(false);
  };

  if (sequence.loading || !draft) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-[13px] text-muted">
        <Spinner /> Loading sequence...
      </div>
    );
  }

  if (sequence.error || !sequence.data) {
    return (
      <>
        <PageHeader title="Sequence" backHref="/sequences" backLabel="Sequences" />
        <div className="p-6">
          <ErrorNote>{sequence.error ?? "That sequence could not be found."}</ErrorNote>
        </div>
      </>
    );
  }

  const list = enrollments.data ?? [];
  const activeCount = list.filter((e) => e.status === "active").length;
  const exitedCount = list.filter((e) =>
    ["exited", "unsubscribed", "completed", "failed"].includes(e.status),
  ).length;

  return (
    <>
      <PageHeader
        backHref="/sequences"
        backLabel="Sequences"
        title={draft.name || "Untitled Sequence"}
        subtitle={
          dirty ? "Unpublished changes" : `Last published ${new Date(sequence.data.updatedAt).toLocaleString()}`
        }
        actions={
          <>
            <span className="mr-1 flex items-center gap-2">
              <span className="text-[12px] font-medium text-muted">
                {draft.enabled ? "Enabled" : "Disabled"}
              </span>
              <Toggle
                label="Enable sequence"
                checked={draft.enabled}
                disabled={pending}
                onChange={setEnabled}
              />
            </span>

            {dirty && (
              <Button onClick={discard} disabled={pending}>
                Discard changes
              </Button>
            )}

            <Menu
              trigger={({ toggle }) => (
                <Button
                  variant={dirty ? "primary" : "secondary"}
                  loading={pending}
                  disabled={!dirty && problems.length === 0}
                  onClick={problems.length ? toggle : publish}
                >
                  {dirty ? "Publish changes" : "Published"}
                </Button>
              )}
            >
              <p className="px-2 py-1.5 text-[12px] font-medium text-bad">
                Fix these before publishing
              </p>
              {problems.map((p, i) => (
                <MenuItem key={i}>{p}</MenuItem>
              ))}
            </Menu>

            <Button variant="primary" icon={<Users size={14} />} onClick={() => setEnrolling(true)}>
              Enroll recipients
            </Button>
          </>
        }
      />

      {(error || problems.length > 0) && (
        <div className="shrink-0 border-b border-line bg-surface px-6 py-2">
          {error && <ErrorNote>{error}</ErrorNote>}
          {problems.length > 0 && (
            <p className="flex items-start gap-1.5 text-[12px] text-warn">
              <CircleAlert size={13} className="mt-0.5 shrink-0" />
              <span>{problems.join(" ")}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="canvas-grid min-w-0 flex-1 overflow-y-auto">
          <SequenceCanvas draft={draft} onChange={setDraft} people={people.data ?? []} />
        </div>

        <aside className="flex w-[380px] shrink-0 flex-col border-l border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <Input
              aria-label="Sequence name"
              className="h-8 border-transparent bg-transparent px-1 text-[15px] font-semibold hover:border-line-strong"
              value={draft.name}
              placeholder="Untitled Sequence"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Textarea
              aria-label="Description"
              rows={2}
              className="mt-1 border-transparent bg-transparent px-1 text-[12px] hover:border-line-strong"
              value={draft.description ?? ""}
              placeholder="Add a description..."
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <Tabs
            className="px-2 pt-1"
            value={panel}
            onChange={setPanel}
            tabs={[
              { id: "settings", label: "Settings" },
              { id: "recipients", label: "Recipients", count: list.length },
            ]}
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel === "settings" ? (
              <SequenceSettings draft={draft} onChange={setDraft} />
            ) : (
              <div className="flex flex-col">
                <div className="grid grid-cols-3 gap-px border-b border-line bg-line">
                  <Insight label="Active" value={activeCount} />
                  <Insight label="Enrolled" value={list.length} />
                  <Insight label="Exited" value={exitedCount} />
                </div>

                <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[12px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Send size={13} className="text-faint" />
                    {pluralize(stats.data?.emailsSent ?? 0, "email")} sent
                  </span>
                  <Badge tone="muted">{stats.data?.replyRate ?? "0%"} replied</Badge>
                </div>

                {enrollments.loading && list.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-8 text-[13px] text-muted">
                    <Spinner /> Loading recipients...
                  </div>
                ) : list.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <p className="text-[13px] font-medium text-ink">No recipients yet</p>
                    <p className="mx-auto mt-1 text-[12px] leading-relaxed text-muted">
                      This sequence is {draft.enabled ? "enabled" : "disabled"} with 0 recipients, so
                      nothing is sending. Enroll someone, or add an Enroll in sequence block to a
                      workflow.
                    </p>
                    <Button
                      className="mt-3"
                      size="sm"
                      variant="primary"
                      onClick={() => setEnrolling(true)}
                    >
                      Enroll recipients
                    </Button>
                  </div>
                ) : (
                  <RecipientsList
                    enrollments={list}
                    peopleById={peopleById}
                    sequencesById={sequencesById}
                    onChanged={() => {
                      void enrollments.refresh();
                      void stats.refresh();
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        title="Disable sequence"
        description={`${pluralize(activeCount, "recipient")} still active`}
        footer={
          <>
            <Button onClick={() => setConfirmDisable(false)}>Cancel</Button>
            <Button loading={pending} onClick={() => disableAndExit(false)}>
              Keep them enrolled
            </Button>
            <Button variant="danger" loading={pending} onClick={() => disableAndExit(true)}>
              Exit all recipients
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          Disabling stops sending either way. The difference is what happens next:{" "}
          <strong className="text-ink">Keep them enrolled</strong> leaves everyone where they are,
          so they carry on from the same step the moment you switch the sequence back on &mdash;
          which can mean a follow-up arriving weeks late.{" "}
          <strong className="text-ink">Exit all recipients</strong> removes them for good, and they
          would need enrolling again.
        </p>
      </Modal>

      <EnrollDialog
        open={enrolling}
        sequenceId={id}
        onClose={() => setEnrolling(false)}
        onEnrolled={() => {
          void enrollments.refresh();
          void stats.refresh();
          setPanel("recipients");
        }}
      />
    </>
  );
}

function Insight({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface px-3 py-2.5 text-center">
      <p className="text-[11px] text-faint">{label}</p>
      <p className="tabular-nums text-[17px] font-semibold text-ink">{value}</p>
    </div>
  );
}
