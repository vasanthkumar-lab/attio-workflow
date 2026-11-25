"use client";

import { useState } from "react";
import {
  ChevronDown, ChevronRight, Clock, Copy, LogOut, Mail, Plus, Trash2, UserPlus,
} from "lucide-react";
import { Badge, Button, IconButton, Input } from "@/components/ui";
import { EmailComposer } from "./EmailComposer";
import { describeCondition } from "@/lib/conditions";
import { cx, pluralize } from "@/lib/format";
import type { Person, SequenceInput, SequenceStep } from "@/lib/types";

const NEW_STEP: SequenceStep = {
  waitBusinessDays: 3,
  body: "Hi {{firstName | there}}, just bringing this back to the top of your inbox.",
};

/**
 * The sequence canvas: enrollment, the email steps with the waits between them, and the
 * exit rules at the end. Selecting an email opens its composer in place.
 */
export function SequenceCanvas({
  draft,
  onChange,
  people,
}: {
  draft: SequenceInput;
  onChange: (next: SequenceInput) => void;
  people: Person[];
}) {
  const [open, setOpen] = useState<number | undefined>(0);

  const setSteps = (steps: SequenceStep[]) => onChange({ ...draft, steps });

  const updateStep = (index: number, next: SequenceStep) =>
    setSteps(draft.steps.map((s, i) => (i === index ? next : s)));

  const addStep = () => {
    setSteps([...draft.steps, { ...NEW_STEP }]);
    setOpen(draft.steps.length);
  };

  const duplicateStep = (index: number) => {
    const copy = structuredClone(draft.steps[index]);
    setSteps([...draft.steps.slice(0, index + 1), copy, ...draft.steps.slice(index + 1)]);
    setOpen(index + 1);
  };

  const deleteStep = (index: number) => {
    setSteps(draft.steps.filter((_, i) => i !== index));
    setOpen(undefined);
  };

  const exitSummary = [
    draft.exitCriteria.onReply && "Reply received",
    ...draft.exitCriteria.when.map((c) => describeCondition(c)),
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-stretch px-6 py-8">
      <Node tone="good" icon={<UserPlus size={15} />} title="Enrollment" subtitle="Recipients enter here, by hand or from a workflow" />

      {draft.steps.map((step, index) => {
        const expanded = open === index;
        return (
          <div key={index} className="contents">
            <WaitChip
              index={index}
              value={step.waitBusinessDays}
              businessDaysOnly={draft.delivery.businessDaysOnly}
              onChange={(waitBusinessDays) => updateStep(index, { ...step, waitBusinessDays })}
            />

            <Connector />

            <div
              className={cx(
                "overflow-hidden rounded-xl border bg-surface shadow-card transition-colors",
                expanded ? "border-accent ring-2 ring-accent/15" : "border-line hover:border-line-strong",
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(expanded ? undefined : index)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left"
              >
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
                  <Mail size={14} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink">Email {index + 1}</span>
                    {index > 0 && draft.email.threadEmails && <Badge tone="muted">Same thread</Badge>}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-ink">
                    {index > 0 && draft.email.threadEmails
                      ? `Re: ${draft.steps[0].subject || "(no subject)"}`
                      : step.subject || <span className="text-faint">No subject yet</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted">
                    {step.body.split("\n")[0] || "Empty body"}
                  </span>
                </span>

                <span className="mt-0.5 shrink-0 text-faint">
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              </button>

              {expanded && (
                <>
                  <EmailComposer
                    index={index}
                    step={step}
                    firstSubject={draft.steps[0].subject ?? ""}
                    email={draft.email}
                    signature={draft.signature}
                    people={people}
                    onChange={(next) => updateStep(index, next)}
                  />
                  <div className="flex items-center justify-end gap-1 border-t border-line bg-raised px-3 py-2">
                    <Button size="sm" variant="ghost" icon={<Copy size={13} />} onClick={() => duplicateStep(index)}>
                      Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 size={13} />}
                      disabled={draft.steps.length === 1}
                      onClick={() => deleteStep(index)}
                      className="text-bad hover:bg-bad-soft hover:text-bad"
                    >
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      <Connector />

      <button
        type="button"
        onClick={addStep}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-surface/60 px-4 py-3 text-[13px] font-medium text-muted transition-colors hover:border-accent hover:bg-accent-soft/40 hover:text-accent-ink"
      >
        <Plus size={15} />
        Add step to sequence
      </button>

      <Connector />

      <Node
        tone="muted"
        icon={<LogOut size={15} />}
        title="Exit"
        subtitle={
          exitSummary.length
            ? exitSummary.join(" · ")
            : "Recipients leave when every email has been sent"
        }
      />

      <p className="mt-4 text-center text-[12px] text-muted">
        {pluralize(draft.steps.length, "email")} over{" "}
        {draft.steps.reduce((n, s) => n + s.waitBusinessDays, 0)} business days
      </p>
    </div>
  );
}

function Connector() {
  return <div className="mx-auto h-5 w-px bg-line-strong" />;
}

function Node({
  tone,
  icon,
  title,
  subtitle,
}: {
  tone: "good" | "muted";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
      <span
        className={cx(
          "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
          tone === "good" ? "bg-good-soft text-good" : "bg-canvas text-muted",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-ink">{title}</span>
        <span className="block truncate text-[12px] text-muted">{subtitle}</span>
      </span>
    </div>
  );
}

/**
 * The wait between steps. Step 1 is phrased as "Start immediately after enrollment", the way
 * Attio does; later steps wait at least one business day.
 */
function WaitChip({
  index,
  value,
  businessDaysOnly,
  onChange,
}: {
  index: number;
  value: number;
  businessDaysOnly: boolean;
  onChange: (next: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const min = index === 0 ? 0 : 1;
  const unit = businessDaysOnly ? "business days" : "days";

  const label =
    index === 0
      ? value === 0
        ? "Start immediately after enrollment"
        : `Start ${value} ${unit} after enrollment`
      : `Wait ${value} ${unit}`;

  return (
    <>
      <Connector />
      {editing ? (
        <div className="mx-auto flex items-center gap-2 rounded-full border border-accent bg-surface px-3 py-1.5 shadow-card">
          <Clock size={13} className="text-accent" />
          <Input
            type="number"
            min={min}
            autoFocus
            className="h-6 w-16 px-1.5 text-center text-[12px]"
            value={value}
            onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
          />
          <span className="text-[12px] text-muted">{unit}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted shadow-card transition-colors hover:border-line-strong hover:text-ink"
        >
          <Clock size={13} className="text-faint" />
          {label}
        </button>
      )}
    </>
  );
}
