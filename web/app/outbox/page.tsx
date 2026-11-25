"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleAlert, Clock, Inbox, Play, Send } from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import {
  Badge, Button, Card, EmptyState, ErrorNote, Spinner, Tabs,
} from "@/components/ui";
import { PersonCell } from "@/components/people/PersonBits";
import { api } from "@/lib/api";
import { useAction, useInterval, useQuery } from "@/lib/hooks";
import { renderTemplate, previewData } from "@/lib/template";
import { formatDateTime, formatHour, humanize, pluralize, relativeTime } from "@/lib/format";
import type { Enrollment, Person, Sequence } from "@/lib/types";

type Tab = "queued" | "attention" | "sent";

interface QueuedEmail {
  enrollment: Enrollment;
  sequence: Sequence;
  person: Person;
  stepIndex: number;
  subject: string;
  sendAt: string;
}

/**
 * The Outbox: what is about to go out, what is stuck, and what already went.
 * Everything here is derived from enrollments, the same way the runner picks work up.
 */
export default function OutboxPage() {
  const enrollments = useQuery(() => api.enrollments.list(), []);
  const sequences = useQuery(() => api.sequences.list(), []);
  const people = useQuery(() => api.people.list(), []);
  const [tab, setTab] = useState<Tab>("queued");
  const { run, pending } = useAction();

  const refresh = () => {
    void enrollments.refresh();
  };

  // The runner ticks every 30s (2s with FAST_DEMO), so keep this view moving.
  useInterval(refresh, 5000, true);

  const sequencesById = useMemo(
    () => new Map((sequences.data ?? []).map((s) => [s.id, s])),
    [sequences.data],
  );
  const peopleById = useMemo(
    () => new Map((people.data ?? []).map((p) => [p.id, p])),
    [people.data],
  );

  const loading = enrollments.loading || sequences.loading || people.loading;
  const error = enrollments.error ?? sequences.error ?? people.error;

  const queued = useMemo<QueuedEmail[]>(() => {
    const rows: QueuedEmail[] = [];
    for (const e of enrollments.data ?? []) {
      if (e.status !== "active") continue;
      const sequence = sequencesById.get(e.sequenceId);
      const person = peopleById.get(e.personId);
      const step = sequence?.steps[e.currentStep];
      if (!sequence || !person || !step) continue;

      // Mirrors the runner: a threaded follow-up reuses "Re: <first subject>".
      const threaded = e.currentStep > 0 && sequence.email.threadEmails;
      const template = threaded
        ? `Re: ${e.firstSubject ?? sequence.steps[0].subject ?? ""}`
        : step.subject ?? `Re: ${e.firstSubject ?? ""}`;

      rows.push({
        enrollment: e,
        sequence,
        person,
        stepIndex: e.currentStep,
        subject: renderTemplate(template, previewData(person)),
        sendAt: e.nextSendAt,
      });
    }
    return rows.sort((a, b) => a.sendAt.localeCompare(b.sendAt));
  }, [enrollments.data, sequencesById, peopleById]);

  const attention = useMemo(
    () =>
      (enrollments.data ?? []).filter((e) => e.status === "paused" || e.status === "failed"),
    [enrollments.data],
  );

  const sent = useMemo(() => {
    const rows = (enrollments.data ?? []).flatMap((e) =>
      e.sent.map((s) => ({ enrollment: e, sent: s })),
    );
    return rows.sort((a, b) => b.sent.sentAt.localeCompare(a.sent.sentAt)).slice(0, 50);
  }, [enrollments.data]);

  const dueNow = queued.filter((q) => new Date(q.sendAt) <= new Date()).length;

  return (
    <>
      <PageHeader
        title="Outbox"
        subtitle="Emails your sequences are about to send, and anything that needs a hand."
        actions={
          <Button size="sm" onClick={refresh} loading={enrollments.loading}>
            Refresh
          </Button>
        }
      >
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "queued", label: "Queued", count: queued.length },
            { id: "attention", label: "Needs attention", count: attention.length },
            { id: "sent", label: "Sent", count: sent.length },
          ]}
        />
      </PageHeader>

      <PageBody>
        {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

        {dueNow > 0 && tab === "queued" && (
          <p className="mb-3 flex items-center gap-1.5 text-[12px] text-muted">
            <Clock size={13} className="text-faint" />
            {pluralize(dueNow, "email")} due now &mdash; the runner picks them up on its next
            tick, if the sequence is enabled and inside its sending window.
          </p>
        )}

        <Card className="overflow-hidden">
          {loading && !enrollments.data ? (
            <div className="flex items-center gap-2 px-4 py-10 text-[13px] text-muted">
              <Spinner /> Loading outbox...
            </div>
          ) : tab === "queued" ? (
            queued.length === 0 ? (
              <EmptyState
                icon={<Inbox size={18} />}
                title="Nothing queued"
                description="Once someone is enrolled in an enabled sequence, their next email shows up here with the time it will go out."
              />
            ) : (
              <ul>
                {queued.map((q) => (
                  <li
                    key={q.enrollment.id}
                    className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-canvas/70"
                  >
                    <span className="w-44 shrink-0">
                      <PersonCell person={q.person} href={`/people/${q.person.id}`} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{q.subject}</span>
                      <span className="block truncate text-[12px] text-muted">
                        <Link href={`/sequences/${q.sequence.id}`} className="hover:underline">
                          {q.sequence.name}
                        </Link>{" "}
                        &middot; Email {q.stepIndex + 1} of {q.sequence.steps.length} &middot; from{" "}
                        {q.enrollment.sender}
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      <span className="block text-[12px] font-medium text-ink">
                        {relativeTime(q.sendAt)}
                      </span>
                      <span className="block text-[11px] text-faint">
                        {formatDateTime(q.sendAt)}
                      </span>
                    </span>

                    <span className="w-24 shrink-0 text-right">
                      {!q.sequence.enabled ? (
                        <Badge tone="warn">Sequence off</Badge>
                      ) : new Date(q.sendAt) <= new Date() ? (
                        <Badge tone="accent">Due</Badge>
                      ) : (
                        <Badge tone="muted">Scheduled</Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : tab === "attention" ? (
            attention.length === 0 ? (
              <EmptyState
                icon={<Send size={18} />}
                title="Nothing stuck"
                description="Recipients land here when a variable has no value and no fallback, or when sending failed repeatedly."
              />
            ) : (
              <ul>
                {attention.map((e) => {
                  const person = peopleById.get(e.personId);
                  const sequence = sequencesById.get(e.sequenceId);
                  return (
                    <li
                      key={e.id}
                      className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0"
                    >
                      <CircleAlert
                        size={15}
                        className={e.status === "failed" ? "mt-1 text-bad" : "mt-1 text-warn"}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium text-ink">
                            {person ? (
                              <Link href={`/people/${person.id}`} className="hover:underline">
                                {person.name ?? person.email}
                              </Link>
                            ) : (
                              e.personId
                            )}
                          </span>
                          <Badge tone={e.status === "failed" ? "bad" : "warn"}>
                            {humanize(e.status)}
                          </Badge>
                          {sequence && (
                            <span className="text-[12px] text-muted">{sequence.name}</span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
                          {e.lastError ?? "Paused manually."}
                        </span>
                      </span>

                      <Button
                        size="sm"
                        icon={<Play size={13} />}
                        loading={pending}
                        onClick={async () => {
                          const ok = await run(() => api.enrollments.resume(e.id));
                          if (ok) refresh();
                        }}
                      >
                        Resume
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : sent.length === 0 ? (
            <EmptyState
              icon={<Send size={18} />}
              title="Nothing sent yet"
              description="Sent emails appear here. Without a Resend key they are printed to the server console instead of delivered."
            />
          ) : (
            <ul>
              {sent.map(({ enrollment, sent: s }) => {
                const person = peopleById.get(enrollment.personId);
                const sequence = sequencesById.get(enrollment.sequenceId);
                return (
                  <li
                    key={s.messageId}
                    className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-canvas/70"
                  >
                    <span className="w-44 shrink-0">
                      {person ? (
                        <PersonCell person={person} href={`/people/${person.id}`} />
                      ) : (
                        <span className="text-[13px] text-muted">{enrollment.personId}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{s.subject}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {sequence?.name ?? enrollment.sequenceId} &middot; Email {s.step + 1}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] text-muted">
                      {formatDateTime(s.sentAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {tab === "queued" && (sequences.data?.length ?? 0) > 0 && (
          <p className="mt-3 text-[12px] text-muted">
            Sending windows:{" "}
            {(sequences.data ?? [])
              .map(
                (s) =>
                  `${s.name} ${formatHour(s.delivery.startHour)}–${formatHour(
                    s.delivery.endHour,
                  )} ${s.delivery.timezone}`,
              )
              .join(" · ")}
          </p>
        )}
      </PageBody>
    </>
  );
}
