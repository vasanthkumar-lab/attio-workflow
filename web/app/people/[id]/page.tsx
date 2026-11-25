"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Mail, Pencil, Play, Sparkles } from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import {
  Avatar, Badge, Button, Card, ErrorNote, Field, Input, Menu, MenuItem, MenuLabel,
  SectionTitle, Select, Spinner, Tabs,
} from "@/components/ui";
import { ScorePill, SegmentBadge, StageBadge, TagList } from "@/components/people/PersonBits";
import { EnrollDialog } from "@/components/sequences/EnrollDialog";
import { RecipientsTable } from "@/components/sequences/RecipientsTable";
import { RunList } from "@/components/workflows/RunList";
import { api } from "@/lib/api";
import { useAction, useQuery } from "@/lib/hooks";
import { STAGES } from "@/lib/catalog";
import { displayName, formatDateTime, humanize, initials, pluralize } from "@/lib/format";
import type { Person, PersonInput } from "@/lib/types";

type Tab = "sequences" | "runs";

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();

  const person = useQuery(() => api.people.get(id), [id]);
  const enrollments = useQuery(() => api.enrollments.list({ personId: id }), [id]);
  const runs = useQuery(() => api.workflows.runs({ personId: id }), [id]);
  const sequences = useQuery(() => api.sequences.list(), []);
  const workflows = useQuery(() => api.workflows.list(), []);

  const [tab, setTab] = useState<Tab>("sequences");
  const [enrolling, setEnrolling] = useState(false);
  const [editing, setEditing] = useState(false);
  const { run, pending, error } = useAction();

  const sequencesById = useMemo(
    () => new Map((sequences.data ?? []).map((s) => [s.id, s])),
    [sequences.data],
  );
  const peopleById = useMemo(
    () => (person.data ? new Map([[person.data.id, person.data]]) : new Map()),
    [person.data],
  );

  const refreshAll = () => {
    void person.refresh();
    void enrollments.refresh();
    void runs.refresh();
  };

  const triggerWorkflow = async (workflowId: string) => {
    const result = await run(() => api.workflows.runNow(workflowId, id));
    if (result) {
      setTab("runs");
      refreshAll();
    }
  };

  if (person.loading) {
    return (
      <PageBody>
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <Spinner /> Loading record...
        </div>
      </PageBody>
    );
  }

  if (person.error || !person.data) {
    return (
      <>
        <PageHeader title="Person" backHref="/people" backLabel="People" />
        <PageBody>
          <ErrorNote>{person.error ?? "That person could not be found."}</ErrorNote>
        </PageBody>
      </>
    );
  }

  const p = person.data;

  return (
    <>
      <PageHeader
        backHref="/people"
        backLabel="People"
        title={
          <span className="flex items-center gap-2.5">
            <Avatar initials={initials(p)} className="h-8 w-8 text-[12px]" />
            {displayName(p)}
          </span>
        }
        subtitle={p.title ? `${p.title}${p.company ? ` at ${p.company}` : ""}` : p.email}
        actions={
          <>
            <Menu
              trigger={({ toggle }) => (
                <Button icon={<Play size={14} />} onClick={toggle} loading={pending}>
                  Run workflow
                </Button>
              )}
            >
              <MenuLabel>Run for this person</MenuLabel>
              {(workflows.data ?? []).length === 0 && (
                <p className="px-2 py-1.5 text-[12px] text-muted">No workflows yet.</p>
              )}
              {workflows.data?.map((w) => (
                <MenuItem key={w.id} onClick={() => triggerWorkflow(w.id)}>
                  {w.name}
                </MenuItem>
              ))}
            </Menu>
            <Button variant="primary" icon={<Mail size={14} />} onClick={() => setEnrolling(true)}>
              Enroll in sequence
            </Button>
          </>
        }
      />

      <PageBody>
        {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit">
            <div className="flex items-center justify-between px-4 py-3">
              <SectionTitle>Attributes</SectionTitle>
              <Button
                size="sm"
                variant="ghost"
                icon={editing ? <Check size={14} /> : <Pencil size={13} />}
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? "Done" : "Edit"}
              </Button>
            </div>

            {editing ? (
              <AttributeEditor person={p} onSaved={() => { setEditing(false); refreshAll(); }} />
            ) : (
              <dl className="border-t border-line">
                <Row label="Email" value={p.email} />
                <Row label="Name" value={p.name} />
                <Row label="Job title" value={p.title} />
                <Row label="Company" value={p.company} />
                <Row label="Domain" value={p.domain} />
                <Row label="Industry" value={p.industry} />
                <Row label="Company size" value={p.companySize?.toLocaleString()} />
                <Row label="Location" value={p.location} />
                <Row label="Stage" value={<StageBadge stage={p.stage} />} />
                <Row label="Score" value={<ScorePill score={p.score} />} />
                <Row label="Segment" value={<SegmentBadge segment={p.segment} />} />
                <Row label="Owner" value={p.owner} />
                <Row label="Tags" value={<TagList tags={p.tags} />} />
                <Row
                  label="Enriched"
                  value={
                    p.enrichedAt ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px]">
                        <Sparkles size={13} className="text-violet" />
                        {formatDateTime(p.enrichedAt)}
                      </span>
                    ) : undefined
                  }
                />
                <Row label="Created" value={formatDateTime(p.createdAt)} />
              </dl>
            )}

            {p.description && (
              <div className="border-t border-line px-4 py-3">
                <SectionTitle>Description</SectionTitle>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{p.description}</p>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <Tabs
              className="px-2 pt-1"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "sequences", label: "Sequences", count: enrollments.data?.length ?? 0 },
                { id: "runs", label: "Workflow runs", count: runs.data?.length ?? 0 },
              ]}
            />

            {tab === "sequences" ? (
              enrollments.loading ? (
                <Loading />
              ) : (enrollments.data?.length ?? 0) === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-[13px] font-medium text-ink">Not in any sequence</p>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">
                    Enroll this person, or let a workflow do it when they match your rules.
                  </p>
                  <Button
                    className="mt-3"
                    variant="primary"
                    size="sm"
                    onClick={() => setEnrolling(true)}
                  >
                    Enroll in sequence
                  </Button>
                </div>
              ) : (
                <RecipientsTable
                  showSequence
                  enrollments={enrollments.data ?? []}
                  peopleById={peopleById}
                  sequencesById={sequencesById}
                  onChanged={refreshAll}
                />
              )
            ) : runs.loading ? (
              <Loading />
            ) : (
              <RunList
                runs={runs.data ?? []}
                peopleById={peopleById}
                showWorkflow
                emptyHint="Nothing has run for this person yet. Use Run workflow above to try one."
              />
            )}
          </Card>
        </div>

        {(enrollments.data?.length ?? 0) > 0 && (
          <p className="mt-3 text-[12px] text-muted">
            {pluralize(
              enrollments.data?.reduce((n, e) => n + e.sent.length, 0) ?? 0,
              "email",
            )}{" "}
            sent to this person by sequences.
          </p>
        )}
      </PageBody>

      <EnrollDialog
        open={enrolling}
        personIds={[id]}
        onClose={() => setEnrolling(false)}
        onEnrolled={refreshAll}
      />
    </>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 px-4 py-10 text-[13px] text-muted">
      <Spinner /> Loading...
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-line px-4 py-2 last:border-b-0">
      <dt className="w-28 shrink-0 text-[12px] text-faint">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-[13px] text-ink">
        {value === undefined || value === null || value === "" ? (
          <span className="text-faint">&mdash;</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

const EDITABLE: { key: keyof PersonInput; label: string; type?: string }[] = [
  { key: "name", label: "Name" },
  { key: "title", label: "Job title" },
  { key: "company", label: "Company" },
  { key: "industry", label: "Industry" },
  { key: "companySize", label: "Company size", type: "number" },
  { key: "location", label: "Location" },
  { key: "owner", label: "Owner", type: "email" },
];

function AttributeEditor({ person, onSaved }: { person: Person; onSaved: () => void }) {
  const [draft, setDraft] = useState<Partial<PersonInput>>({
    name: person.name ?? "",
    title: person.title ?? "",
    company: person.company ?? "",
    industry: person.industry ?? "",
    companySize: person.companySize,
    location: person.location ?? "",
    owner: person.owner ?? "",
    stage: person.stage,
  });
  const [tags, setTags] = useState(person.tags.join(", "));
  const { run, pending, error } = useAction();

  const save = async () => {
    const payload: Partial<PersonInput> = { ...draft };
    // Blank optional strings would fail validation (owner must be an email), so drop them.
    for (const key of Object.keys(payload) as (keyof PersonInput)[]) {
      if (payload[key] === "" || payload[key] === undefined) delete payload[key];
    }
    payload.tags = tags.split(",").map((t) => t.trim()).filter(Boolean);

    const saved = await run(() => api.people.update(person.id, payload));
    if (saved) onSaved();
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
      {error && <ErrorNote>{error}</ErrorNote>}

      {EDITABLE.map(({ key, label, type }) => (
        <Field key={key} label={label}>
          <Input
            type={type}
            value={(draft[key] as string | number | undefined) ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                [key]:
                  type === "number"
                    ? e.target.value === ""
                      ? undefined
                      : Number(e.target.value)
                    : e.target.value,
              }))
            }
          />
        </Field>
      ))}

      <Field label="Stage" hint="Changing this can exit the person from sequences with matching exit criteria">
        <Select
          value={draft.stage ?? person.stage}
          onChange={(e) => setDraft((d) => ({ ...d, stage: e.target.value }))}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Tags" hint="Comma separated">
        <Input value={tags} onChange={(e) => setTags(e.target.value)} />
      </Field>

      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" loading={pending} onClick={save}>
          Save changes
        </Button>
        <Badge tone="muted">Updates fire Record updated workflows</Badge>
      </div>
    </div>
  );
}
