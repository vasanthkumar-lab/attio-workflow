"use client";

import { useMemo, useState } from "react";
import { Check, Search, TriangleAlert } from "lucide-react";
import {
  Badge, Button, Checkbox, Dot, ErrorNote, Input, Modal, Spinner,
} from "@/components/ui";
import { PersonCell } from "@/components/people/PersonBits";
import { api } from "@/lib/api";
import { useAction, useQuery } from "@/lib/hooks";
import { cx, displayName, pluralize } from "@/lib/format";
import type { EnrollResult } from "@/lib/types";

/**
 * Enroll recipients. Two directions, same dialog:
 *  - give it a sequenceId and it picks people
 *  - give it personIds and it picks the sequence
 */
export function EnrollDialog({
  open,
  onClose,
  sequenceId,
  personIds,
  onEnrolled,
}: {
  open: boolean;
  onClose: () => void;
  sequenceId?: string;
  personIds?: string[];
  onEnrolled?: () => void;
}) {
  const pickingPeople = Boolean(sequenceId);

  const people = useQuery(() => (open && pickingPeople ? api.people.list() : Promise.resolve([])), [open, pickingPeople]);
  const sequences = useQuery(() => (open && !pickingPeople ? api.sequences.list() : Promise.resolve([])), [open, pickingPeople]);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [chosenSequence, setChosenSequence] = useState("");
  const [results, setResults] = useState<EnrollResult[]>();
  const { run, pending, error } = useAction();

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = people.data ?? [];
    if (!q) return all;
    return all.filter((p) =>
      [p.name, p.email, p.company, p.title].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [people.data, search]);

  const targetSequence = sequenceId ?? chosenSequence;
  const targetPeople = pickingPeople ? selected : personIds ?? [];
  const canSubmit = Boolean(targetSequence) && targetPeople.length > 0 && targetPeople.length <= 1000;

  const close = () => {
    setSearch("");
    setSelected([]);
    setChosenSequence("");
    setResults(undefined);
    onClose();
  };

  const submit = async () => {
    const res = await run(() => api.sequences.enroll(targetSequence, targetPeople));
    if (res) {
      setResults(res);
      onEnrolled?.();
    }
  };

  const enrolledCount = results?.filter((r) => r.enrolled).length ?? 0;
  const skipped = results?.filter((r) => !r.enrolled) ?? [];

  return (
    <Modal
      open={open}
      onClose={close}
      width="max-w-xl"
      title={results ? "Enrollment results" : "Enroll recipients"}
      description={
        results
          ? undefined
          : pickingPeople
            ? "Pick the people who should start this sequence. Up to 1,000 at a time."
            : "Pick the sequence these people should start."
      }
      footer={
        results ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" loading={pending} disabled={!canSubmit} onClick={submit}>
              {pickingPeople
                ? `Enroll ${selected.length ? pluralize(selected.length, "person", "people") : ""}`.trim()
                : "Enroll"}
            </Button>
          </>
        )
      }
    >
      {error && <ErrorNote className="mb-3">{error}</ErrorNote>}

      {results ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-ink">
            <span className="font-medium">{pluralize(enrolledCount, "recipient")}</span> enrolled.
            {skipped.length > 0 && ` ${skipped.length} skipped.`}
          </p>
          {skipped.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {skipped.map((r) => (
                <li key={r.personId} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                  <TriangleAlert size={14} className="shrink-0 text-warn" />
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {people.data?.find((p) => p.id === r.personId)
                      ? displayName(people.data.find((p) => p.id === r.personId)!)
                      : r.personId}
                  </span>
                  <Badge tone="warn">{r.reason}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : pickingPeople ? (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <Input
              className="pl-8"
              placeholder="Search by name, email or company"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-line">
            {people.loading ? (
              <div className="flex items-center gap-2 px-3 py-6 text-[13px] text-muted">
                <Spinner /> Loading people...
              </div>
            ) : filteredPeople.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-muted">No people match.</p>
            ) : (
              <ul className="divide-y divide-line">
                {filteredPeople.map((p) => {
                  const checked = selected.includes(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((prev) =>
                            checked ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                          )
                        }
                        className={cx(
                          "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                          checked ? "bg-accent-soft/60" : "hover:bg-canvas",
                        )}
                      >
                        <Checkbox checked={checked} onChange={() => {}} label={displayName(p)} />
                        <span className="min-w-0 flex-1">
                          <PersonCell person={p} />
                        </span>
                        <span className="shrink-0 text-[12px] text-muted">{p.company ?? ""}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="text-[12px] text-muted">
            {selected.length
              ? `${pluralize(selected.length, "person", "people")} selected`
              : "Nobody selected yet"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted">
            Enrolling {pluralize(personIds?.length ?? 0, "person", "people")}.
          </p>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-line">
            {sequences.loading ? (
              <div className="flex items-center gap-2 px-3 py-6 text-[13px] text-muted">
                <Spinner /> Loading sequences...
              </div>
            ) : (sequences.data?.length ?? 0) === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-muted">
                No sequences yet. Create one first.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {sequences.data?.map((s) => {
                  const active = chosenSequence === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setChosenSequence(s.id)}
                        className={cx(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                          active ? "bg-accent-soft/60" : "hover:bg-canvas",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <Dot tone={s.enabled ? "good" : "muted"} />
                            <span className="truncate text-[13px] font-medium text-ink">{s.name}</span>
                          </span>
                          <span className="mt-0.5 block text-[12px] text-muted">
                            {pluralize(s.steps.length, "email")} &middot;{" "}
                            {s.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </span>
                        {active && <Check size={15} className="shrink-0 text-accent" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
