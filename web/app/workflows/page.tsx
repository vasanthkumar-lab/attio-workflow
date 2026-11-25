"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Copy, GitBranch, Plus, Trash2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import {
  Badge, Button, Card, Dot, EmptyState, ErrorNote, IconButton, Menu, MenuItem, Modal, Spinner,
} from "@/components/ui";
import { RunList } from "@/components/workflows/RunList";
import { api } from "@/lib/api";
import { useAction, useQuery } from "@/lib/hooks";
import { blankWorkflow, toWorkflowInput } from "@/lib/drafts";
import { triggerDef } from "@/lib/catalog";
import { countSteps } from "@/lib/workflow-tree";
import { pluralize, relativeTime } from "@/lib/format";
import type { Workflow } from "@/lib/types";

export default function WorkflowsPage() {
  const router = useRouter();
  const workflows = useQuery(() => api.workflows.list(), []);
  const runs = useQuery(() => api.workflows.runs(), []);
  const people = useQuery(() => api.people.list(), []);
  const { run, pending, error } = useAction();
  const [confirmDelete, setConfirmDelete] = useState<Workflow>();

  const peopleById = new Map((people.data ?? []).map((p) => [p.id, p]));

  const create = async () => {
    const created = await run(() => api.workflows.create(blankWorkflow()));
    if (created) router.push(`/workflows/${created.id}`);
  };

  const duplicate = async (workflow: Workflow) => {
    const copy = await run(() =>
      api.workflows.create({
        ...toWorkflowInput(workflow),
        name: `${workflow.name} (copy)`,
        enabled: false,
      }),
    );
    if (copy) router.push(`/workflows/${copy.id}`);
  };

  const remove = async (workflow: Workflow) => {
    const done = await run(() => api.workflows.remove(workflow.id));
    if (done) {
      setConfirmDelete(undefined);
      void workflows.refresh();
    }
  };

  return (
    <>
      <PageHeader
        title="Workflows"
        subtitle="When something happens, do this. Research, score, route and enroll, automatically."
        actions={
          <Button variant="primary" icon={<Plus size={14} />} loading={pending} onClick={create}>
            New workflow
          </Button>
        }
      />

      <PageBody>
        {(error || workflows.error) && (
          <ErrorNote className="mb-4">{error ?? workflows.error}</ErrorNote>
        )}

        <Card className="mb-6 overflow-hidden">
          {workflows.loading ? (
            <div className="flex items-center gap-2 px-4 py-10 text-[13px] text-muted">
              <Spinner /> Loading workflows...
            </div>
          ) : (workflows.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<GitBranch size={18} />}
              title="No workflows yet"
              description="A workflow starts on an event, runs its blocks in order, and can branch on anything about the record."
              action={
                <Button variant="primary" icon={<Plus size={14} />} loading={pending} onClick={create}>
                  New workflow
                </Button>
              }
            />
          ) : (
            <ul>
              {workflows.data?.map((w) => {
                const trigger = triggerDef(w.trigger.event);
                const runCount = (runs.data ?? []).filter((r) => r.workflowId === w.id).length;
                const failed = (runs.data ?? []).filter(
                  (r) => r.workflowId === w.id && r.status === "failed",
                ).length;

                return (
                  <li key={w.id} className="border-b border-line last:border-b-0">
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/70">
                      <Link href={`/workflows/${w.id}`} className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <Dot tone={w.enabled ? "good" : "muted"} />
                          <span className="truncate text-[14px] font-medium text-ink">{w.name}</span>
                          {!w.enabled && <Badge tone="muted">Disabled</Badge>}
                          {failed > 0 && <Badge tone="bad">{failed} failed</Badge>}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-muted">
                          {trigger.label} &middot; {pluralize(countSteps(w.steps), "block")}
                        </span>
                      </Link>

                      <div className="hidden shrink-0 items-center gap-6 text-right sm:flex">
                        <div className="w-14">
                          <p className="text-[11px] text-faint">Runs</p>
                          <p className="tabular-nums text-[13px] font-medium text-ink">{runCount}</p>
                        </div>
                        <div className="w-24">
                          <p className="text-[11px] text-faint">Updated</p>
                          <p className="text-[12px] text-muted">{relativeTime(w.updatedAt)}</p>
                        </div>
                      </div>

                      <Menu
                        trigger={({ toggle }) => (
                          <IconButton label="Workflow actions" onClick={toggle}>
                            <span className="text-base leading-none">&#8943;</span>
                          </IconButton>
                        )}
                      >
                        <MenuItem icon={<Copy size={14} />} onClick={() => duplicate(w)}>
                          Duplicate workflow
                        </MenuItem>
                        <MenuItem
                          tone="danger"
                          icon={<Trash2 size={14} />}
                          onClick={() => setConfirmDelete(w)}
                        >
                          Delete workflow
                        </MenuItem>
                      </Menu>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <h2 className="mb-2 text-[13px] font-semibold text-ink">Recent runs</h2>
        <Card className="overflow-hidden">
          {runs.loading ? (
            <div className="flex items-center gap-2 px-4 py-10 text-[13px] text-muted">
              <Spinner /> Loading runs...
            </div>
          ) : (
            <RunList runs={(runs.data ?? []).slice(0, 25)} peopleById={peopleById} showWorkflow />
          )}
        </Card>
      </PageBody>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(undefined)}
        title="Delete workflow"
        description={confirmDelete?.name}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(undefined)}>Cancel</Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => confirmDelete && remove(confirmDelete)}
            >
              Delete workflow
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          It stops running immediately. Past runs stay in the history until the server restarts.
        </p>
      </Modal>
    </>
  );
}
