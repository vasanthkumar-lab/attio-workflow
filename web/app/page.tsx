"use client";

import Link from "next/link";
import {
  ArrowRight, CircleAlert, GitBranch, Mail, RefreshCw, Send, Users,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, Dot, ErrorNote, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useQuery } from "@/lib/hooks";
import { relativeTime } from "@/lib/format";

export default function HomePage() {
  const people = useQuery(() => api.people.list(), []);
  const sequences = useQuery(() => api.sequences.list(), []);
  const workflows = useQuery(() => api.workflows.list(), []);
  const enrollments = useQuery(() => api.enrollments.list(), []);
  const runs = useQuery(() => api.workflows.runs(), []);

  const unreachable = [people, sequences, workflows].find((q) => q.error)?.error;
  const loading = people.loading || sequences.loading || workflows.loading;

  const activeEnrollments = enrollments.data?.filter((e) => e.status === "active").length ?? 0;
  const emailsSent = enrollments.data?.reduce((n, e) => n + e.sent.length, 0) ?? 0;
  const liveWorkflows = workflows.data?.filter((w) => w.enabled).length ?? 0;
  const liveSequences = sequences.data?.filter((s) => s.enabled).length ?? 0;

  return (
    <>
      <PageHeader
        title="Home"
        subtitle="Workflows decide what happens next. Sequences do the following up."
      />
      <PageBody>
        {unreachable && (
          <ErrorNote className="mb-5 flex flex-wrap items-center gap-2">
            <CircleAlert size={15} className="shrink-0" />
            <span className="flex-1">{unreachable}</span>
            <Button
              size="sm"
              icon={<RefreshCw size={13} />}
              onClick={() => {
                for (const q of [people, sequences, workflows, enrollments, runs]) void q.refresh();
              }}
            >
              Try again
            </Button>
          </ErrorNote>
        )}

        {loading && !unreachable ? (
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <Spinner /> Loading your workspace...
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                href="/people"
                icon={<Users size={15} />}
                label="People"
                value={people.data?.length ?? 0}
                note={`${people.data?.filter((p) => p.segment === "priority").length ?? 0} priority`}
              />
              <Stat
                href="/sequences"
                icon={<Mail size={15} />}
                label="Sequences"
                value={sequences.data?.length ?? 0}
                note={`${liveSequences} enabled`}
              />
              <Stat
                href="/workflows"
                icon={<GitBranch size={15} />}
                label="Workflows"
                value={workflows.data?.length ?? 0}
                note={`${liveWorkflows} enabled`}
              />
              <Stat
                href="/sequences"
                icon={<Send size={15} />}
                label="Emails sent"
                value={emailsSent}
                note={`${activeEnrollments} recipients active`}
              />
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <PanelHeader title="Sequences" href="/sequences" />
                {sequences.data?.length ? (
                  <ul>
                    {sequences.data.slice(0, 5).map((s) => (
                      <li key={s.id} className="border-t border-line first:border-t-0">
                        <Link
                          href={`/sequences/${s.id}`}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-canvas"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Dot tone={s.enabled ? "good" : "muted"} />
                            <span className="truncate text-[13px] font-medium text-ink">{s.name}</span>
                          </span>
                          <span className="shrink-0 text-[12px] text-muted">
                            {s.steps.length} {s.steps.length === 1 ? "email" : "emails"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-[13px] text-muted">No sequences yet.</p>
                )}
              </Card>

              <Card>
                <PanelHeader title="Recent workflow runs" href="/workflows" />
                {runs.data?.length ? (
                  <ul>
                    {runs.data.slice(0, 5).map((run) => (
                      <li key={run.id} className="border-t border-line first:border-t-0">
                        <Link
                          href={`/workflows/${run.workflowId}?run=${run.id}`}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-canvas"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-ink">
                              {run.workflowName}
                            </span>
                            <span className="block truncate text-[12px] text-muted">
                              {run.trigger} &middot; {relativeTime(run.startedAt)}
                            </span>
                          </span>
                          <Badge
                            tone={
                              run.status === "completed"
                                ? "good"
                                : run.status === "failed"
                                  ? "bad"
                                  : "warn"
                            }
                          >
                            {run.status}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-6 text-center text-[13px] text-muted">
                    No runs yet. Add a person or use Trigger workflow to start one.
                  </p>
                )}
              </Card>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}

function Stat({
  href, icon, label, value, note,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full px-4 py-3.5 transition-colors group-hover:border-line-strong">
        <div className="flex items-center gap-2 text-muted">
          <span className="text-faint">{icon}</span>
          <span className="text-[12px] font-medium">{label}</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
        <p className="mt-0.5 text-[12px] text-faint">{note}</p>
      </Card>
    </Link>
  );
}

function PanelHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-accent"
      >
        View all <ArrowRight size={12} />
      </Link>
    </div>
  );
}
