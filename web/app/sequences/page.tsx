"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Copy, Mail, Plus, Trash2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import {
  Badge, Button, Card, Dot, EmptyState, ErrorNote, IconButton, Menu, MenuItem, Modal, Spinner,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAction, useQuery } from "@/lib/hooks";
import { blankSequence, toSequenceInput } from "@/lib/drafts";
import { pluralize, relativeTime } from "@/lib/format";
import type { Sequence } from "@/lib/types";

export default function SequencesPage() {
  const router = useRouter();
  const sequences = useQuery(() => api.sequences.list(), []);
  const enrollments = useQuery(() => api.enrollments.list(), []);
  const { run, pending, error } = useAction();
  const [confirmDelete, setConfirmDelete] = useState<Sequence>();

  const create = async () => {
    const created = await run(() => api.sequences.create(blankSequence()));
    if (created) router.push(`/sequences/${created.id}`);
  };

  const duplicate = async (sequence: Sequence) => {
    // Attio copies the emails and settings but not the recipients, and starts it disabled.
    const copy = await run(() =>
      api.sequences.create({
        ...toSequenceInput(sequence),
        name: `${sequence.name} (copy)`,
        enabled: false,
      }),
    );
    if (copy) router.push(`/sequences/${copy.id}`);
  };

  const remove = async (sequence: Sequence) => {
    const done = await run(() => api.sequences.remove(sequence.id));
    if (done) {
      setConfirmDelete(undefined);
      void sequences.refresh();
      void enrollments.refresh();
    }
  };

  const countFor = (sequenceId: string, predicate: (status: string) => boolean) =>
    (enrollments.data ?? []).filter((e) => e.sequenceId === sequenceId && predicate(e.status)).length;

  return (
    <>
      <PageHeader
        title="Sequences"
        subtitle="Timed email campaigns. Enroll people by hand, or let a workflow do it."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} loading={pending} onClick={create}>
            New sequence
          </Button>
        }
      />

      <PageBody>
        {(error || sequences.error) && (
          <ErrorNote className="mb-4">{error ?? sequences.error}</ErrorNote>
        )}

        <Card className="overflow-hidden">
          {sequences.loading ? (
            <div className="flex items-center gap-2 px-4 py-10 text-[13px] text-muted">
              <Spinner /> Loading sequences...
            </div>
          ) : (sequences.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Mail size={18} />}
              title="No sequences yet"
              description="A sequence sends a series of emails over days, waits between them, and stops when someone replies."
              action={
                <Button variant="primary" icon={<Plus size={14} />} loading={pending} onClick={create}>
                  New sequence
                </Button>
              }
            />
          ) : (
            <ul>
              {sequences.data?.map((s) => {
                const active = countFor(s.id, (st) => st === "active");
                const total = countFor(s.id, () => true);

                return (
                  <li key={s.id} className="border-b border-line last:border-b-0">
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/70">
                      <Link href={`/sequences/${s.id}`} className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <Dot tone={s.enabled ? "good" : "muted"} />
                          <span className="truncate text-[14px] font-medium text-ink">{s.name}</span>
                          {!s.enabled && <Badge tone="muted">Disabled</Badge>}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-muted">
                          {s.description?.trim() ||
                            `${pluralize(s.steps.length, "email")} · ${
                              s.delivery.startHour
                            }:00-${s.delivery.endHour}:00 ${s.delivery.timezone}`}
                        </span>
                      </Link>

                      <div className="hidden shrink-0 items-center gap-6 text-right sm:flex">
                        <Stat label="Emails" value={s.steps.length} />
                        <Stat label="Active" value={active} />
                        <Stat label="Enrolled" value={total} />
                        <div className="w-24">
                          <p className="text-[11px] text-faint">Updated</p>
                          <p className="text-[12px] text-muted">{relativeTime(s.updatedAt)}</p>
                        </div>
                      </div>

                      <Menu
                        trigger={({ toggle }) => (
                          <IconButton label="Sequence actions" onClick={toggle}>
                            <span className="text-base leading-none">&#8943;</span>
                          </IconButton>
                        )}
                      >
                        <MenuItem icon={<Copy size={14} />} onClick={() => duplicate(s)}>
                          Duplicate sequence
                        </MenuItem>
                        <MenuItem
                          tone="danger"
                          icon={<Trash2 size={14} />}
                          onClick={() => setConfirmDelete(s)}
                        >
                          Delete sequence
                        </MenuItem>
                      </Menu>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </PageBody>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(undefined)}
        title="Delete sequence"
        description={confirmDelete?.name}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(undefined)}>Cancel</Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => confirmDelete && remove(confirmDelete)}
            >
              Delete sequence
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          Everyone still in this sequence is exited, and no more emails are sent. Workflows with an
          Enroll in sequence block pointing here will start failing, so update them too.
        </p>
      </Modal>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="w-14">
      <p className="text-[11px] text-faint">{label}</p>
      <p className="tabular-nums text-[13px] font-medium text-ink">{value}</p>
    </div>
  );
}
