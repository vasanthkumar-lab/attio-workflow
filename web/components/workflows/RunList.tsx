"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { RunTimeline } from "./RunTimeline";
import { PersonCell } from "@/components/people/PersonBits";
import { cx, duration, formatDateTime, relativeTime } from "@/lib/format";
import type { Person, WorkflowRun } from "@/lib/types";

const STATUS_TONE = { completed: "good", failed: "bad", running: "warn" } as const;

/** The run history. Expanding a run shows the step-by-step log the engine wrote. */
export function RunList({
  runs,
  peopleById,
  showWorkflow = false,
  initialOpenId,
  emptyHint,
}: {
  runs: WorkflowRun[];
  peopleById: Map<string, Person>;
  showWorkflow?: boolean;
  initialOpenId?: string;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState<string | undefined>(initialOpenId);

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={<History size={18} />}
        title="No runs yet"
        description={
          emptyHint ??
          "Runs appear here as soon as the trigger fires, or when you use Trigger workflow."
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr className="border-b border-line bg-raised text-left">
            <Th className="w-8 pl-3" />
            {showWorkflow && <Th>Workflow</Th>}
            <Th>Record</Th>
            <Th>Trigger</Th>
            <Th>Status</Th>
            <Th>Started</Th>
            <Th className="pr-3">Duration</Th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const person = peopleById.get(run.personId);
            const expanded = open === run.id;
            return (
              <Fragment key={run.id}>
                <tr
                  className="cursor-pointer border-b border-line last:border-b-0 hover:bg-canvas/70"
                  onClick={() => setOpen(expanded ? undefined : run.id)}
                >
                  <Td className="pl-3 text-faint">
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </Td>
                  {showWorkflow && (
                    <Td>
                      <Link
                        href={`/workflows/${run.workflowId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[13px] font-medium text-ink hover:underline"
                      >
                        {run.workflowName}
                      </Link>
                    </Td>
                  )}
                  <Td>
                    {person ? (
                      <PersonCell person={person} />
                    ) : (
                      <span className="text-[13px] text-muted">{run.personId}</span>
                    )}
                  </Td>
                  <Td className="text-[12px] text-muted">{run.trigger}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[run.status]}>{run.status}</Badge>
                  </Td>
                  <Td className="text-[12px] text-muted" title={formatDateTime(run.startedAt)}>
                    {relativeTime(run.startedAt)}
                  </Td>
                  <Td className="pr-3 text-[12px] text-muted">
                    {duration(run.startedAt, run.finishedAt)}
                  </Td>
                </tr>

                {expanded && (
                  <tr className="border-b border-line bg-raised last:border-b-0">
                    <td colSpan={showWorkflow ? 7 : 6} className="px-10 py-3">
                      <RunLog run={run} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RunLog({ run }: { run: WorkflowRun }) {
  const [raw, setRaw] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
          {raw ? "Raw log" : "What happened"}
        </p>
        <button
          type="button"
          onClick={() => setRaw((v) => !v)}
          className="text-[11px] font-medium text-muted hover:text-ink"
        >
          {raw ? "Show summary" : "Show raw log"}
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-surface px-3">
        {raw ? (
          <ol className="-mx-3">
            {run.log.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-muted">No steps ran.</li>
            ) : (
              run.log.map((line, i) => (
                <li
                  key={i}
                  className="flex gap-3 border-b border-line px-3 py-1.5 font-mono text-[12px] leading-relaxed text-ink last:border-b-0"
                >
                  <span className="w-5 shrink-0 text-right text-faint">{i + 1}</span>
                  <span className="min-w-0 break-words">{line}</span>
                </li>
              ))
            )}
          </ol>
        ) : (
          <RunTimeline log={run.log} done={run.status === "completed"} />
        )}
      </div>

      {run.error && (
        <p className="rounded-lg bg-bad-soft px-3 py-2 font-mono text-[12px] text-bad">{run.error}</p>
      )}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cx(
        "px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-faint",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className, title }: { children?: React.ReactNode; className?: string; title?: string }) {
  return (
    <td title={title} className={cx("px-3 py-2.5 align-middle", className)}>
      {children}
    </td>
  );
}
