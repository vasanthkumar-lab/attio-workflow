"use client";

import { BookOpen, Check, CircleAlert, GitBranch, Trash2, Zap } from "lucide-react";
import { BLOCK_ICONS } from "./BlockLibrary";
import {
  Badge, Button, Field, Input, SectionTitle, Textarea, ToggleRow,
} from "@/components/ui";
import { blockDef, triggerDef, TONE_CLASSES } from "@/lib/catalog";
import { stepProblem } from "@/lib/drafts";
import { countSteps, pathKey, type StepPath } from "@/lib/workflow-tree";
import { cx, pluralize } from "@/lib/format";
import type { Selection } from "./WorkflowCanvas";
import type { WorkflowInput, WorkflowStep } from "@/lib/types";

interface ChecklistRow {
  path: StepPath;
  step: WorkflowStep;
  depth: number;
  branch?: "True" | "False";
}

/** Flattens the tree so the checklist reads in the order the blocks run. */
function flatten(steps: WorkflowStep[], base: StepPath = [], depth = 0): ChecklistRow[] {
  return steps.flatMap((step, i) => {
    const path = [...base, i];
    const row: ChecklistRow = { path, step, depth };
    if (step.type !== "if") return [row];
    return [
      row,
      ...flatten(step.then, [...path, "then"], depth + 1).map((r) =>
        r.depth === depth + 1 ? { ...r, branch: "True" as const } : r,
      ),
      ...flatten(step.else ?? [], [...path, "else"], depth + 1).map((r) =>
        r.depth === depth + 1 ? { ...r, branch: "False" as const } : r,
      ),
    ];
  });
}

/**
 * The right panel when nothing is selected: what the workflow is, every block in run
 * order with whatever is still missing, and where to read more.
 */
export function WorkflowOverview({
  draft,
  onChange,
  onSelect,
}: {
  draft: WorkflowInput;
  onChange: (next: WorkflowInput) => void;
  onSelect: (selection: Selection) => void;
}) {
  const rows = flatten(draft.steps);
  const trigger = triggerDef(draft.trigger.event);
  const incomplete = rows.filter((r) => stepProblem(r.step)).length;

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3 border-b border-line px-4 py-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
          <GitBranch size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <Input
            aria-label="Workflow name"
            className="h-7 border-transparent bg-transparent px-1 text-[14px] font-semibold hover:border-line-strong"
            value={draft.name}
            placeholder="Untitled Workflow"
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
          <Textarea
            aria-label="Workflow description"
            rows={2}
            className="mt-1 border-transparent bg-transparent px-1 text-[12px] hover:border-line-strong"
            value={draft.description ?? ""}
            placeholder="Add a description..."
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
          />
        </div>
      </div>

      <div className="border-b border-line px-4 py-3">
        <SectionTitle>Checklist</SectionTitle>

        <button
          type="button"
          onClick={() => onSelect({ kind: "trigger" })}
          className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-canvas"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-ink">
            <Zap size={12} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{trigger.label}</span>
          <Check size={14} className="shrink-0 text-good" />
        </button>

        {rows.length === 0 ? (
          <p className="px-1.5 py-2 text-[12px] text-muted">
            No blocks yet. Use Add block on the canvas.
          </p>
        ) : (
          rows.map((row) => {
            const def = blockDef(row.step.type);
            const Icon = BLOCK_ICONS[row.step.type];
            const problem = stepProblem(row.step);
            return (
              <button
                key={pathKey(row.path)}
                type="button"
                onClick={() => onSelect({ kind: "step", path: row.path })}
                className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-canvas"
                style={{ paddingLeft: 6 + row.depth * 12 }}
              >
                <span
                  className={cx(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-md",
                    TONE_CLASSES[def.tone].chip,
                  )}
                >
                  <Icon size={12} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] text-ink">{def.label}</span>
                    {row.branch && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase text-faint">
                        {row.branch}
                      </span>
                    )}
                  </span>
                  {problem && (
                    <span className="block truncate text-[11px] text-warn">{problem}</span>
                  )}
                </span>
                {problem ? (
                  <CircleAlert size={14} className="shrink-0 text-warn" />
                ) : (
                  <Check size={14} className="shrink-0 text-good" />
                )}
              </button>
            );
          })
        )}

        <p className="mt-2 px-1.5 text-[11px] text-faint">
          {pluralize(countSteps(draft.steps), "block")}
          {incomplete > 0 && ` · ${incomplete} need setting up`}
        </p>
      </div>

      <div className="px-4 py-3">
        <SectionTitle>Helpful resources</SectionTitle>
        <div className="mt-2 rounded-lg border border-line bg-raised px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <BookOpen size={13} className="text-faint" />
            Documentation
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Blocks run top to bottom. An <strong className="text-ink">If</strong> block splits the
            run into a True and a False path. Use{" "}
            <strong className="text-ink">Trigger workflow</strong> to test on one person before
            enabling it.
          </p>
        </div>
        <div className="mt-2 rounded-lg border border-line bg-raised px-3 py-2.5">
          <p className="text-[13px] font-medium text-ink">Canvas shortcuts</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[12px] text-muted">
            <Shortcut keys="B" action="Add block" />
            <Shortcut keys="V" action="Select tool" />
            <Shortcut keys="H / hold space" action="Pan the canvas" />
            <Shortcut keys="Ctrl + scroll" action="Zoom" />
          </ul>
        </div>
      </div>
    </div>
  );
}

function Shortcut({ keys, action }: { keys: string; action: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span>{action}</span>
      <kbd className="rounded border border-line bg-surface px-1 font-sans text-[10px] text-muted">
        {keys}
      </kbd>
    </li>
  );
}

/** The Settings tab: the things that are about the workflow rather than one block. */
export function WorkflowSettings({
  draft,
  onChange,
  enabled,
  onEnabledChange,
  onDelete,
  busy,
}: {
  draft: WorkflowInput;
  onChange: (next: WorkflowInput) => void;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-6">
      <section className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <SectionTitle>General</SectionTitle>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4">
          <Field label="Name">
            <Input
              value={draft.name}
              placeholder="Untitled Workflow"
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field
            label="Description"
            hint="Only shown here. Useful when someone else opens the workflow."
          >
            <Textarea
              rows={3}
              value={draft.description ?? ""}
              placeholder="What does this workflow do?"
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <SectionTitle>Status</SectionTitle>
        </div>
        <div className="px-4 py-2">
          <ToggleRow
            label="Enable workflow"
            description="When off, the trigger is ignored. Trigger workflow still works for testing, and runs already in progress finish."
            checked={enabled}
            onChange={onEnabledChange}
            disabled={busy}
          />
        </div>
      </section>

      <section className="rounded-xl border border-bad/30 bg-surface">
        <div className="border-b border-line px-4 py-3">
          <SectionTitle>Danger zone</SectionTitle>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink">Delete this workflow</p>
            <p className="mt-0.5 text-[12px] text-muted">
              It stops running immediately. Past runs stay until the server restarts.
            </p>
          </div>
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={onDelete} loading={busy}>
            Delete workflow
          </Button>
        </div>
      </section>

      <p className="text-[12px] text-muted">
        <Badge tone="muted">Note</Badge> Sharing and per-member permissions are not part of this
        build, since the API has no accounts.
      </p>
    </div>
  );
}
