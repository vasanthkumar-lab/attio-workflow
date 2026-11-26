"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { BLOCK_ICONS } from "./BlockLibrary";
import { ConditionBuilder } from "@/components/ConditionBuilder";
import {
  Badge, Button, IconButton, Input, Menu, MenuItem, SectionTitle, Select, Textarea, ToggleRow,
} from "@/components/ui";
import {
  AGENT_FIELDS, PERSON_FIELDS, STAGES, TONE_CLASSES, TRIGGERS, WRITABLE_FIELDS,
  blockDef, fieldDef, fieldLabel, triggerDef,
} from "@/lib/catalog";
import { cx, humanize } from "@/lib/format";
import type {
  Condition, ScoreRule, Sequence, TriggerEvent, WorkflowInput, WorkflowStep,
} from "@/lib/types";

// ------------------------------------------------------------------ trigger

export function TriggerInspector({
  draft,
  onChange,
  onClose,
}: {
  draft: WorkflowInput;
  onChange: (next: WorkflowInput) => void;
  onClose?: () => void;
}) {
  const def = triggerDef(draft.trigger.event);

  const setTrigger = (patch: Partial<WorkflowInput["trigger"]>) =>
    onChange({ ...draft, trigger: { ...draft.trigger, ...patch } });

  return (
    <div className="flex flex-col">
      <Header
        tone="good"
        title="Trigger"
        subtitle={def.label}
        icon={<span className="text-[13px] font-bold">1</span>}
        actions={
          onClose && (
            <IconButton label="Close panel" onClick={onClose}>
              <X size={15} />
            </IconButton>
          )
        }
      />

      <Section title="Run this workflow when">
        <div className="flex flex-col gap-1.5">
          {TRIGGERS.map((t) => {
            const active = t.event === draft.trigger.event;
            return (
              <button
                key={t.event}
                type="button"
                onClick={() =>
                  onChange({
                    ...draft,
                    // Field filters only apply to Record updated, so drop them otherwise.
                    trigger: {
                      event: t.event as TriggerEvent,
                      condition: draft.trigger.condition,
                      fields: t.supportsFields ? draft.trigger.fields : undefined,
                    },
                  })
                }
                className={cx(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-accent bg-accent-soft/50"
                    : "border-line hover:border-line-strong hover:bg-canvas",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-ink">{t.label}</span>
                  <Badge tone="muted">{t.category}</Badge>
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
                  {t.description}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {def.supportsFields && (
        <Section title="Only when these change">
          <p className="text-[12px] leading-relaxed text-muted">
            Leave everything off to run on any change.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PERSON_FIELDS.filter((f) => f.kind !== "date").map((f) => {
              const on = draft.trigger.fields?.includes(f.key) ?? false;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    const current = draft.trigger.fields ?? [];
                    const next = on
                      ? current.filter((k) => k !== f.key)
                      : [...current, f.key];
                    setTrigger({ fields: next.length ? next : undefined });
                  }}
                  className={cx(
                    "rounded-md px-2 py-1 text-[12px] transition-colors",
                    on
                      ? "bg-accent text-white"
                      : "bg-canvas text-muted ring-1 ring-line hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Filter" last>
        <p className="text-[12px] leading-relaxed text-muted">
          Only run for people who match. Records that do not match are skipped without a run.
        </p>
        <ConditionBuilder
          value={draft.trigger.condition}
          addLabel="Add filter condition"
          onChange={(condition) => setTrigger({ condition })}
        />
      </Section>
    </div>
  );
}

// -------------------------------------------------------------------- block

export function BlockInspector({
  step,
  sequences,
  canMoveUp,
  canMoveDown,
  onChange,
  onDelete,
  onMove,
  onClose,
}: {
  step: WorkflowStep;
  sequences: Sequence[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (next: WorkflowStep) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onClose: () => void;
}) {
  const def = blockDef(step.type);
  const Icon = BLOCK_ICONS[step.type];

  return (
    <div className="flex flex-col">
      <Header
        tone={def.tone}
        title={def.label}
        subtitle={def.description}
        icon={<Icon size={14} />}
        actions={
          <>
            <Menu
              trigger={({ toggle }) => (
                <IconButton label="Block actions" onClick={toggle}>
                  <span className="text-base leading-none">&#8943;</span>
                </IconButton>
              )}
            >
              <MenuItem icon={<ArrowUp size={14} />} onClick={() => canMoveUp && onMove(-1)}>
                Move up
              </MenuItem>
              <MenuItem icon={<ArrowDown size={14} />} onClick={() => canMoveDown && onMove(1)}>
                Move down
              </MenuItem>
              <MenuItem tone="danger" icon={<Trash2 size={14} />} onClick={onDelete}>
                Delete step
              </MenuItem>
            </Menu>
            <IconButton label="Close panel" onClick={onClose}>
              <X size={15} />
            </IconButton>
          </>
        }
      />

      <div className="flex flex-col">
        {step.type === "enrich" && (
          <Section title="What it does" last>
            <p className="text-[13px] leading-relaxed text-muted">
              Looks the person up from their email domain and fills in any blank attributes:
              company, domain, industry, company size, location and description. Attributes that
              already have a value are left alone.
            </p>
          </Section>
        )}

        {step.type === "score" && <ScoreEditor step={step} onChange={onChange} />}

        {step.type === "if" && (
          <>
            <Section title="Label">
              <Input
                value={step.label ?? ""}
                placeholder="e.g. score >= 50"
                onChange={(e) => onChange({ ...step, label: e.target.value })}
              />
            </Section>
            <Section title="Condition" last>
              <p className="text-[12px] leading-relaxed text-muted">
                True runs the left path, False runs the right one.
              </p>
              <ConditionBuilder
                allowEmpty={false}
                value={step.condition}
                onChange={(condition: Condition | undefined) =>
                  onChange({ ...step, condition: condition ?? step.condition })
                }
              />
            </Section>
          </>
        )}

        {step.type === "update" && <UpdateEditor step={step} onChange={onChange} />}

        {step.type === "addTag" && (
          <Section title="Tag" last>
            <Input
              value={step.tag}
              placeholder="e.g. low-fit"
              onChange={(e) => onChange({ ...step, tag: e.target.value })}
            />
            <p className="text-[12px] text-muted">Existing tags are kept.</p>
          </Section>
        )}

        {step.type === "enroll" && (
          <Section title="Sequence" last>
            <Select
              value={step.sequenceId}
              onChange={(e) => onChange({ ...step, sequenceId: e.target.value })}
            >
              <option value="">Choose a sequence</option>
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.enabled ? "" : " (disabled)"}
                </option>
              ))}
            </Select>
            <p className="text-[12px] leading-relaxed text-muted">
              Skipped when the person is already in this sequence, has unsubscribed, or already
              matches its exit criteria. The run log says which.
            </p>
          </Section>
        )}

        {step.type === "webAgent" && <WebAgentEditor step={step} onChange={onChange} />}

        {step.type === "webhook" && (
          <Section title="URL" last>
            <Input
              value={step.url}
              placeholder="https://hooks.slack.com/services/..."
              onChange={(e) => onChange({ ...step, url: e.target.value })}
            />
            <p className="text-[12px] leading-relaxed text-muted">
              POSTs the person and a short summary line as JSON. Must be https. A non-2xx response
              fails the run.
            </p>
          </Section>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- step editors

function ScoreEditor({
  step,
  onChange,
}: {
  step: Extract<WorkflowStep, { type: "score" }>;
  onChange: (next: WorkflowStep) => void;
}) {
  const setRules = (rules: ScoreRule[]) => onChange({ ...step, rules });
  const total = step.rules.reduce((n, r) => n + (r.points || 0), 0);

  return (
    <Section title="Scoring rules" last>
      <p className="text-[12px] leading-relaxed text-muted">
        Every rule that matches adds its points. The total is clamped to 0-100 and saved to Score.
      </p>

      <div className="flex flex-col gap-3">
        {step.rules.map((rule, i) => (
          <div key={i} className="rounded-lg border border-line bg-raised p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-ink">Rule {i + 1}</span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  aria-label="Points"
                  className="h-7 w-16 text-center"
                  value={rule.points}
                  onChange={(e) =>
                    setRules(
                      step.rules.map((r, j) =>
                        j === i ? { ...r, points: Number(e.target.value) || 0 } : r,
                      ),
                    )
                  }
                />
                <span className="text-[12px] text-muted">pts</span>
                <IconButton
                  label="Remove rule"
                  onClick={() => setRules(step.rules.filter((_, j) => j !== i))}
                >
                  <Trash2 size={13} />
                </IconButton>
              </div>
            </div>
            <ConditionBuilder
              allowEmpty={false}
              value={rule.condition}
              onChange={(condition) =>
                setRules(
                  step.rules.map((r, j) =>
                    j === i ? { ...r, condition: condition ?? r.condition } : r,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          icon={<Plus size={14} />}
          onClick={() =>
            setRules([
              ...step.rules,
              { condition: { field: "company", op: "isNotEmpty" }, points: 10 },
            ])
          }
        >
          Add rule
        </Button>
        <Badge tone={total > 100 ? "warn" : "muted"}>
          {total} points max{total > 100 ? " (clamped to 100)" : ""}
        </Badge>
      </div>
    </Section>
  );
}

function WebAgentEditor({
  step,
  onChange,
}: {
  step: Extract<WorkflowStep, { type: "webAgent" }>;
  onChange: (next: WorkflowStep) => void;
}) {
  const toggleField = (key: string) =>
    onChange({
      ...step,
      fields: step.fields.includes(key)
        ? step.fields.filter((f) => f !== key)
        : [...step.fields, key],
    });

  return (
    <>
      <Section title="What to find out">
        <Textarea
          rows={4}
          aria-label="Instruction"
          value={step.instruction}
          placeholder="e.g. Find this person's current job title and employer, and what the company does."
          onChange={(e) => onChange({ ...step, instruction: e.target.value })}
        />
        <p className="text-[12px] leading-relaxed text-muted">
          The agent searches the web, then reports only what it could confirm on a page it
          read. Anything it cannot verify is left blank rather than guessed.
        </p>
      </Section>

      <Section title="Attributes it may fill">
        <div className="flex flex-wrap gap-1.5">
          {AGENT_FIELDS.map((key) => {
            const on = step.fields.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleField(key)}
                className={cx(
                  "rounded-md px-2 py-1 text-[12px] transition-colors",
                  on ? "bg-accent text-white" : "bg-canvas text-muted ring-1 ring-line hover:text-ink",
                )}
              >
                {fieldLabel(key)}
              </button>
            );
          })}
        </div>
        <p className="text-[12px] leading-relaxed text-muted">
          Nothing outside this list can be written, whatever the instruction says.
        </p>
      </Section>

      <Section title="Existing values" last>
        <ToggleRow
          label="Overwrite what is already there"
          description="Off by default, so the agent fills gaps and leaves anything a person entered alone."
          checked={step.overwrite ?? false}
          onChange={(overwrite) => onChange({ ...step, overwrite })}
        />
        <p className="text-[12px] leading-relaxed text-muted">
          Needs <code className="font-mono">OPENROUTER_API_KEY</code> on the server. Without it
          the block logs &ldquo;skipped&rdquo; and the rest of the workflow carries on.
        </p>
      </Section>
    </>
  );
}

function UpdateEditor({
  step,
  onChange,
}: {
  step: Extract<WorkflowStep, { type: "update" }>;
  onChange: (next: WorkflowStep) => void;
}) {
  const entries = Object.entries(step.fields);

  const setEntries = (next: [string, unknown][]) =>
    onChange({ ...step, fields: Object.fromEntries(next.filter(([k]) => k)) });

  const unusedField = WRITABLE_FIELDS.find((f) => !(f.key in step.fields))?.key ?? "segment";

  return (
    <Section title="Attributes to write" last>
      <p className="text-[12px] leading-relaxed text-muted">
        Email, created date and tags are protected by the API and cannot be written here.
      </p>

      <div className="flex flex-col gap-2">
        {entries.map(([key, value], i) => {
          const def = fieldDef(key);
          const options = def?.key === "stage" ? STAGES : def?.options;

          return (
            <div key={i} className="flex items-start gap-1.5">
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
                <Select
                  aria-label="Attribute"
                  value={key}
                  onChange={(e) =>
                    setEntries(entries.map((pair, j) => (j === i ? [e.target.value, value] : pair)))
                  }
                >
                  {WRITABLE_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </Select>

                {options ? (
                  <Select
                    aria-label="Value"
                    value={String(value ?? "")}
                    onChange={(e) =>
                      setEntries(entries.map((pair, j) => (j === i ? [key, e.target.value] : pair)))
                    }
                  >
                    <option value="">Choose a value</option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {humanize(o)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    aria-label="Value"
                    type={def?.kind === "number" ? "number" : "text"}
                    value={String(value ?? "")}
                    onChange={(e) =>
                      setEntries(
                        entries.map((pair, j) =>
                          j === i
                            ? [
                                key,
                                def?.kind === "number"
                                  ? Number(e.target.value) || 0
                                  : e.target.value,
                              ]
                            : pair,
                        ),
                      )
                    }
                  />
                )}
              </div>

              <div className="pt-1">
                <IconButton
                  label="Remove attribute"
                  onClick={() => setEntries(entries.filter((_, j) => j !== i))}
                >
                  <X size={14} />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        size="sm"
        icon={<Plus size={14} />}
        onClick={() => setEntries([...entries, [unusedField, ""]])}
      >
        Add attribute
      </Button>
    </Section>
  );
}

// --------------------------------------------------------------- shell bits

function Header({
  tone,
  title,
  subtitle,
  icon,
  actions,
}: {
  tone: keyof typeof TONE_CLASSES;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-line px-4 py-3">
      <span
        className={cx(
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
          TONE_CLASSES[tone].chip,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{subtitle}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
    </div>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={last ? "px-4 py-4" : "border-b border-line px-4 py-4"}>
      <SectionTitle>{title}</SectionTitle>
      <div className="mt-2.5 flex flex-col gap-3">{children}</div>
    </section>
  );
}
