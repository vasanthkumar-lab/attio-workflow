"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Users, X } from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import {
  Button, Card, Checkbox, EmptyState, ErrorNote, Field, Input, Modal, Select, Spinner,
} from "@/components/ui";
import { PersonCell, ScorePill, SegmentBadge, StageBadge, TagList } from "@/components/people/PersonBits";
import { EnrollDialog } from "@/components/sequences/EnrollDialog";
import { api } from "@/lib/api";
import { useAction, useQuery } from "@/lib/hooks";
import { STAGES } from "@/lib/catalog";
import { humanize, pluralize, relativeTime } from "@/lib/format";
import type { PersonInput } from "@/lib/types";

export default function PeoplePage() {
  const people = useQuery(() => api.people.list(), []);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = [...(people.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!q) return all;
    return all.filter((p) =>
      [p.name, p.email, p.company, p.title, p.segment, p.stage].some((v) =>
        v?.toLowerCase().includes(q),
      ),
    );
  }, [people.data, search]);

  const allChecked = rows.length > 0 && rows.every((p) => selected.includes(p.id));
  const someChecked = selected.length > 0 && !allChecked;

  return (
    <>
      <PageHeader
        title="People"
        subtitle="Every person in the CRM. Creating one fires the Record created workflows."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            New person
          </Button>
        }
      />

      <PageBody>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="relative w-72 max-w-full">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <Input
              className="pl-8"
              placeholder="Search people"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="text-[12px] text-muted">{pluralize(rows.length, "record")}</p>
        </div>

        {people.error && <ErrorNote className="mb-4">{people.error}</ErrorNote>}

        <Card className="overflow-hidden">
          {people.loading ? (
            <div className="flex items-center gap-2 px-4 py-10 text-[13px] text-muted">
              <Spinner /> Loading people...
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Users size={18} />}
              title={search ? "No people match that search" : "No people yet"}
              description={
                search
                  ? "Try a different name, company or email."
                  : "Add your first person. If a Record created workflow is enabled, it runs straight away."
              }
              action={
                !search && (
                  <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
                    New person
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse">
                <thead>
                  <tr className="border-b border-line bg-raised text-left">
                    <Th className="w-9 pl-4">
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        label="Select all"
                        onChange={(next) => setSelected(next ? rows.map((p) => p.id) : [])}
                      />
                    </Th>
                    <Th>Name</Th>
                    <Th>Company</Th>
                    <Th>Job title</Th>
                    <Th>Stage</Th>
                    <Th>Score</Th>
                    <Th>Segment</Th>
                    <Th>Tags</Th>
                    <Th className="pr-4">Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-b-0 hover:bg-canvas/70">
                      <Td className="pl-4">
                        <Checkbox
                          checked={selected.includes(p.id)}
                          label={`Select ${p.email}`}
                          onChange={(next) =>
                            setSelected((prev) =>
                              next ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                            )
                          }
                        />
                      </Td>
                      <Td>
                        <PersonCell person={p} href={`/people/${p.id}`} />
                      </Td>
                      <Td className="text-[13px] text-ink">
                        {p.company ?? <span className="text-faint">&mdash;</span>}
                      </Td>
                      <Td className="text-[13px] text-muted">
                        {p.title ?? <span className="text-faint">&mdash;</span>}
                      </Td>
                      <Td>
                        <StageBadge stage={p.stage} />
                      </Td>
                      <Td>
                        <ScorePill score={p.score} />
                      </Td>
                      <Td>
                        <SegmentBadge segment={p.segment} />
                      </Td>
                      <Td>
                        <TagList tags={p.tags} />
                      </Td>
                      <Td className="pr-4 text-[12px] text-muted">{relativeTime(p.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageBody>

      {/* Attio shows a selection bar at the bottom with Enroll in sequence. */}
      {selected.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 shadow-pop">
            <span className="text-[13px] font-medium text-ink">
              {pluralize(selected.length, "person", "people")} selected
            </span>
            <Button size="sm" variant="primary" onClick={() => setEnrolling(true)}>
              Enroll in sequence
            </Button>
            <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <EnrollDialog
        open={enrolling}
        personIds={selected}
        onClose={() => setEnrolling(false)}
        onEnrolled={() => setSelected([])}
      />

      <NewPersonDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          void people.refresh();
        }}
      />
    </>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-faint ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle ${className ?? ""}`}>{children}</td>;
}

const EMPTY: PersonInput = { email: "", stage: "lead" };

function NewPersonDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [draft, setDraft] = useState<PersonInput>(EMPTY);
  const [tags, setTags] = useState("");
  const { run, pending, error } = useAction();

  const set = <K extends keyof PersonInput>(key: K, value: PersonInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    const payload: PersonInput = { ...draft };
    // The API rejects empty strings on optional fields, so drop anything blank.
    for (const key of Object.keys(payload) as (keyof PersonInput)[]) {
      if (payload[key] === "" || payload[key] === undefined) delete payload[key];
    }
    const parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (parsedTags.length) payload.tags = parsedTags;

    const created = await run(() => api.people.create(payload));
    if (created) {
      setDraft(EMPTY);
      setTags("");
      onCreated();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New person"
      description="Only an email address is required."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={pending} disabled={!draft.email} onClick={submit}>
            Create person
          </Button>
        </>
      }
    >
      {error && <ErrorNote className="mb-3">{error}</ErrorNote>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" className="sm:col-span-2">
          <Input
            type="email"
            placeholder="priya@acme.com"
            value={draft.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Name">
          <Input value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Job title">
          <Input value={draft.title ?? ""} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Company">
          <Input value={draft.company ?? ""} onChange={(e) => set("company", e.target.value)} />
        </Field>
        <Field label="Industry">
          <Input value={draft.industry ?? ""} onChange={(e) => set("industry", e.target.value)} />
        </Field>
        <Field label="Company size">
          <Input
            type="number"
            min={0}
            value={draft.companySize ?? ""}
            onChange={(e) =>
              set("companySize", e.target.value === "" ? undefined : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Location">
          <Input value={draft.location ?? ""} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label="Owner" hint="Their emails are sent from this address">
          <Input
            type="email"
            placeholder="rep@yourteam.com"
            value={draft.owner ?? ""}
            onChange={(e) => set("owner", e.target.value)}
          />
        </Field>
        <Field label="Stage">
          <Select value={draft.stage ?? "lead"} onChange={(e) => set("stage", e.target.value)}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tags" hint="Comma separated" className="sm:col-span-2">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="inbound, demo-request" />
        </Field>
      </div>
    </Modal>
  );
}
