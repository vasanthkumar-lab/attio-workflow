"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  ChevronDown, ChevronRight, CornerUpLeft, LogOut, Pause, Play,
} from "lucide-react";
import { Avatar, Badge, Button, ErrorNote, IconButton, Menu, MenuItem, Textarea } from "@/components/ui";
import { EmailThread } from "@/components/sequences/EmailThread";
import { PersonCell } from "@/components/people/PersonBits";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { ENROLLMENT_STATUS } from "@/lib/catalog";
import { cx, displayName, formatDateTime, humanize, initials, relativeTime } from "@/lib/format";
import type { Enrollment, Person, Sequence } from "@/lib/types";

interface SharedProps {
  enrollments: Enrollment[];
  peopleById: Map<string, Person>;
  sequencesById: Map<string, Sequence>;
  onChanged: () => void;
}

const statusOf = (e: Enrollment) =>
  ENROLLMENT_STATUS[e.status] ?? { label: e.status, tone: "muted" as const };

function stepLabel(e: Enrollment, total: number): string {
  if (e.status === "completed") return `All ${total} sent`;
  // Someone who left early never reaches the step they were waiting on, so count what was sent.
  if (["exited", "unsubscribed", "failed"].includes(e.status))
    return `${e.sent.length} of ${total} sent`;
  return `Step ${Math.min(e.currentStep + 1, total)} of ${total}`;
}

/** The actions Attio offers per recipient: Pause, Resume and Exit from sequence. */
function RecipientActions({
  enrollment: e,
  onChanged,
}: {
  enrollment: Enrollment;
  onChanged: () => void;
}) {
  const { run, pending } = useAction();
  const act = async (fn: () => Promise<unknown>) => {
    const ok = await run(fn);
    if (ok) onChanged();
  };

  return (
    <Menu
      trigger={({ toggle }) => (
        <IconButton label="Recipient actions" onClick={toggle} disabled={pending}>
          <span className="text-base leading-none">&#8943;</span>
        </IconButton>
      )}
    >
      {e.status === "active" && (
        <MenuItem icon={<Pause size={14} />} onClick={() => act(() => api.enrollments.pause(e.id))}>
          Pause
        </MenuItem>
      )}
      {(e.status === "paused" || e.status === "failed") && (
        <MenuItem icon={<Play size={14} />} onClick={() => act(() => api.enrollments.resume(e.id))}>
          Resume
        </MenuItem>
      )}
      {(e.status === "active" || e.status === "paused") && (
        <>
          <MenuItem
            icon={<CornerUpLeft size={14} />}
            onClick={() => act(() => api.enrollments.reply(e.id))}
          >
            Mark as replied
          </MenuItem>
          <MenuItem
            tone="danger"
            icon={<LogOut size={14} />}
            onClick={() => act(() => api.enrollments.remove(e.id))}
          >
            Exit from sequence
          </MenuItem>
        </>
      )}
      {!["active", "paused", "failed"].includes(e.status) && (
        <p className="px-2 py-1.5 text-[12px] text-muted">
          {e.exitReason ? humanize(e.exitReason) : "No actions available"}
        </p>
      )}
    </Menu>
  );
}

/** Compact rows for the sequence editor's right sidebar. */
export function RecipientsList({ enrollments, peopleById, sequencesById, onChanged }: SharedProps) {
  const [open, setOpen] = useState<string>();

  return (
    <ul>
      {enrollments.map((e) => {
        const person = peopleById.get(e.personId);
        const total = sequencesById.get(e.sequenceId)?.steps.length ?? e.sent.length + 1;
        const status = statusOf(e);
        const expanded = open === e.id;

        return (
          <li key={e.id} className="border-b border-line last:border-b-0">
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-canvas/70">
              <button
                type="button"
                onClick={() => setOpen(expanded ? undefined : e.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                {person ? (
                  <Avatar initials={initials(person)} />
                ) : (
                  <Avatar initials="?" className="bg-canvas text-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {person ? displayName(person) : e.personId}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {stepLabel(e, total)}
                    {e.status === "active" && ` · next ${relativeTime(e.nextSendAt)}`}
                  </span>
                </span>
                <Badge tone={status.tone}>{status.label}</Badge>
              </button>
              <RecipientActions enrollment={e} onChanged={onChanged} />
            </div>

            {expanded && (
              <div className="border-t border-line bg-raised px-3 py-2.5">
                <EnrollmentDetail
                  enrollment={e}
                  sequence={sequencesById.get(e.sequenceId)}
                  onChanged={onChanged}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The full table, used on a person record where there is room for it. */
export function RecipientsTable({
  enrollments,
  peopleById,
  sequencesById,
  showSequence = false,
  onChanged,
}: SharedProps & { showSequence?: boolean }) {
  const [open, setOpen] = useState<string>();
  const { error } = useAction();

  return (
    <div className="flex flex-col gap-2">
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-line bg-raised text-left">
              <Th className="w-8 pl-3" />
              <Th>{showSequence ? "Sequence" : "Recipient"}</Th>
              <Th>Status</Th>
              <Th>Step</Th>
              <Th>Next email</Th>
              <Th>Enrolled by</Th>
              <Th className="w-10 pr-3" />
            </tr>
          </thead>
          <tbody>
            {enrollments.map((e) => {
              const person = peopleById.get(e.personId);
              const sequence = sequencesById.get(e.sequenceId);
              const total = sequence?.steps.length ?? e.sent.length + 1;
              const status = statusOf(e);
              const expanded = open === e.id;

              return (
                <Fragment key={e.id}>
                  <tr className="border-b border-line last:border-b-0 hover:bg-canvas/70">
                    <Td className="pl-3">
                      <IconButton
                        label={expanded ? "Collapse" : "Expand"}
                        onClick={() => setOpen(expanded ? undefined : e.id)}
                      >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </IconButton>
                    </Td>

                    <Td>
                      {showSequence ? (
                        sequence ? (
                          <Link
                            href={`/sequences/${sequence.id}`}
                            className="text-[13px] font-medium text-ink hover:underline"
                          >
                            {sequence.name}
                          </Link>
                        ) : (
                          <span className="text-[13px] text-muted">{e.sequenceId}</span>
                        )
                      ) : person ? (
                        <PersonCell person={person} href={`/people/${person.id}`} />
                      ) : (
                        <span className="text-[13px] text-muted">{e.personId}</span>
                      )}
                    </Td>

                    <Td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </Td>

                    <Td className="text-[13px] text-ink">{stepLabel(e, total)}</Td>

                    <Td className="text-[13px] text-muted">
                      {e.status === "active" ? (
                        relativeTime(e.nextSendAt)
                      ) : (
                        <span className="text-faint">&mdash;</span>
                      )}
                    </Td>

                    <Td className="text-[12px] text-muted">{humanize(e.enrolledBy.split(":")[0])}</Td>

                    <Td className="pr-3">
                      <RecipientActions enrollment={e} onChanged={onChanged} />
                    </Td>
                  </tr>

                  {expanded && (
                    <tr className="border-b border-line bg-raised last:border-b-0">
                      <td colSpan={7} className="px-10 py-3">
                        <EnrollmentDetail enrollment={e} sequence={sequence} onChanged={onChanged} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EnrollmentDetail({
  enrollment: e,
  sequence,
  onChanged,
}: {
  enrollment: Enrollment;
  sequence?: Sequence;
  onChanged: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-2">
        <Detail label="Sender" value={e.sender} />
        <Detail label="Enrolled" value={formatDateTime(e.enrolledAt)} />
        <Detail label="Enrolled by" value={e.enrolledBy} />
        {e.exitReason && <Detail label="Exit reason" value={humanize(e.exitReason)} />}
        {e.replied && <Detail label="Replied" value="Yes" />}
        {sequence && (
          <Detail
            label="Window"
            value={`${sequence.delivery.startHour}:00-${sequence.delivery.endHour}:00 ${sequence.delivery.timezone}`}
          />
        )}
      </dl>

      {e.lastError && (
        <ErrorNote>
          {e.lastError}
          {e.status === "paused" && " — fix the record, then resume."}
        </ErrorNote>
      )}

      <EmailThread enrollment={e} />
      {e.sent.length > 0 && <LogReply enrollment={e} onLogged={onChanged} />}
    </div>
  );
}

/**
 * Until an inbox sync exists, a reply gets into the CRM because somebody read it in
 * their mail client and pasted it here. That is worth building anyway: the sync will
 * call the same endpoint, so this is the manual path to the same place, not a stand-in
 * that gets thrown away.
 */
function LogReply({ enrollment: e, onLogged }: { enrollment: Enrollment; onLogged: () => void }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const { run, pending, error } = useAction();

  if (!open) {
    return (
      <div>
        <Button variant="ghost" onClick={() => setOpen(true)}>
          <CornerUpLeft className="size-3.5" />
          {e.replied ? "Log another reply" : "Log a reply"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-2.5">
      <Textarea
        autoFocus
        rows={4}
        value={body}
        onChange={(ev) => setBody(ev.target.value)}
        placeholder="Paste what they wrote back..."
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          loading={pending}
          disabled={pending || !body.trim()}
          onClick={async () => {
            const saved = await run(() => api.enrollments.reply(e.id, { body }));
            // Only clear on success, or a failed save silently eats what they typed.
            if (saved) {
              setBody("");
              setOpen(false);
              onLogged();
            }
          }}
        >
          Save reply
        </Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setBody(""); }}>
          Cancel
        </Button>
        <span className="text-[11px] text-faint">
          Stops follow-ups and fires any workflow listening for a reply.
        </span>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-faint">{label}</dt>
      <dd className="min-w-0 truncate text-ink">{value}</dd>
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

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cx("px-3 py-2.5 align-middle", className)}>{children}</td>;
}
