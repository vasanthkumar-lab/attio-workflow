"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, GitBranch, History, Info, Play, Settings } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  Badge, Button, ErrorNote, Menu, MenuItem, Modal, Select, Spinner, Tabs, Toggle,
} from "@/components/ui";
import { WorkflowCanvas, type Selection } from "@/components/workflows/WorkflowCanvas";
import { BlockInspector, TriggerInspector } from "@/components/workflows/BlockInspector";
import { WorkflowOverview, WorkflowSettings } from "@/components/workflows/WorkflowPanels";
import { RunList } from "@/components/workflows/RunList";
import { api } from "@/lib/api";
import { useAction, useInterval, useQuery } from "@/lib/hooks";
import { toWorkflowInput, validateWorkflow } from "@/lib/drafts";
import { triggerDef } from "@/lib/catalog";
import { displayName } from "@/lib/format";
import { getList, getStep, moveStep, removeStep, updateStep } from "@/lib/workflow-tree";
import type { WorkflowInput, WorkflowRun } from "@/lib/types";

type Tab = "editor" | "runs" | "settings";

export default function WorkflowPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center gap-2 text-[13px] text-muted">
          <Spinner /> Loading workflow...
        </div>
      }
    >
      <WorkflowBuilder />
    </Suspense>
  );
}

function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedRun = searchParams.get("run") ?? undefined;

  const workflow = useQuery(() => api.workflows.get(id), [id]);
  const runs = useQuery(() => api.workflows.runs({ workflowId: id }), [id]);
  const sequences = useQuery(() => api.sequences.list(), []);
  const people = useQuery(() => api.people.list(), []);

  const [draft, setDraft] = useState<WorkflowInput>();
  const [selected, setSelected] = useState<Selection>({ kind: "none" });
  const [tab, setTab] = useState<Tab>(highlightedRun ? "runs" : "editor");
  const [triggering, setTriggering] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, pending, error } = useAction();

  useEffect(() => {
    if (workflow.data && !draft) setDraft(toWorkflowInput(workflow.data));
  }, [workflow.data, draft]);

  useInterval(() => void runs.refresh(), 5000, tab === "runs");

  const published = workflow.data ? toWorkflowInput(workflow.data) : undefined;
  const dirty = useMemo(
    () => Boolean(draft && published) && JSON.stringify(draft) !== JSON.stringify(published),
    [draft, published],
  );
  const problems = useMemo(() => (draft ? validateWorkflow(draft) : []), [draft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const peopleById = useMemo(
    () => new Map((people.data ?? []).map((p) => [p.id, p])),
    [people.data],
  );
  const sequencesById = useMemo(
    () => new Map((sequences.data ?? []).map((s) => [s.id, s])),
    [sequences.data],
  );

  const publish = async () => {
    if (!draft) return;
    const saved = await run(() => api.workflows.update(id, draft));
    if (saved) {
      workflow.set(saved);
      setDraft(toWorkflowInput(saved));
    }
  };

  const discard = () => {
    if (!workflow.data) return;
    setDraft(toWorkflowInput(workflow.data));
    setSelected({ kind: "none" });
  };

  const setEnabled = async (enabled: boolean) => {
    const saved = await run(() => api.workflows.setEnabled(id, enabled));
    if (saved) {
      workflow.set(saved);
      setDraft((d) => (d ? { ...d, enabled } : d));
    }
  };

  const remove = async () => {
    const done = await run(() => api.workflows.remove(id));
    if (done) router.push("/workflows");
  };

  if (workflow.loading || !draft) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-[13px] text-muted">
        <Spinner /> Loading workflow...
      </div>
    );
  }

  if (workflow.error || !workflow.data) {
    return (
      <>
        <PageHeader title="Workflow" backHref="/workflows" backLabel="Workflows" />
        <div className="p-6">
          <ErrorNote>{workflow.error ?? "That workflow could not be found."}</ErrorNote>
        </div>
      </>
    );
  }

  const selectedStep = selected.kind === "step" ? getStep(draft.steps, selected.path) : undefined;
  const siblingCount =
    selected.kind === "step" ? getList(draft.steps, selected.path.slice(0, -1)).length : 0;
  const selectedIndex =
    selected.kind === "step" ? (selected.path[selected.path.length - 1] as number) : -1;

  return (
    <>
      <PageHeader
        backHref="/workflows"
        backLabel="Workflows"
        title={draft.name || "Untitled Workflow"}
        subtitle={
          dirty
            ? "Draft · unpublished changes"
            : `${triggerDef(draft.trigger.event).label} · published ${new Date(
                workflow.data.updatedAt,
              ).toLocaleString()}`
        }
        actions={
          <>
            <span className="mr-1 flex items-center gap-2">
              <span className="text-[12px] font-medium text-muted">
                {draft.enabled ? "Enabled" : "Disabled"}
              </span>
              <Toggle
                label="Enable workflow"
                checked={draft.enabled}
                disabled={pending}
                onChange={setEnabled}
              />
            </span>
            <Button icon={<Play size={14} />} onClick={() => setTriggering(true)}>
              Trigger workflow
            </Button>
          </>
        }
      >
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "editor", label: "Editor", icon: <GitBranch size={13} /> },
            { id: "runs", label: "Runs", count: runs.data?.length ?? 0, icon: <History size={13} /> },
            { id: "settings", label: "Settings", icon: <Settings size={13} /> },
          ]}
        />
      </PageHeader>

      {error && (
        <div className="shrink-0 border-b border-line bg-surface px-6 py-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {tab === "editor" ? (
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {(dirty || problems.length > 0) && (
              <div
                className={`flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2.5 ${
                  problems.length > 0
                    ? "border-warn/30 bg-warn-soft"
                    : "border-accent/30 bg-accent-soft"
                }`}
              >
                {problems.length > 0 ? (
                  <CircleAlert size={15} className="shrink-0 text-warn" />
                ) : (
                  <Info size={15} className="shrink-0 text-accent-ink" />
                )}
                <p
                  className={`min-w-0 flex-1 text-[13px] font-medium ${
                    problems.length > 0 ? "text-warn" : "text-accent-ink"
                  }`}
                >
                  {problems.length > 0
                    ? `Finish ${problems.length === 1 ? "1 block" : `${problems.length} items`} before publishing`
                    : "This workflow has unpublished changes"}
                </p>
                {dirty && (
                  <Button size="sm" onClick={discard} disabled={pending}>
                    Discard changes
                  </Button>
                )}
                {problems.length > 0 ? (
                  <Menu
                    trigger={({ toggle }) => (
                      <Button size="sm" onClick={toggle}>
                        What is missing
                      </Button>
                    )}
                  >
                    {problems.map((p, i) => (
                      <MenuItem key={i}>{p}</MenuItem>
                    ))}
                  </Menu>
                ) : (
                  <Button size="sm" variant="primary" loading={pending} onClick={publish}>
                    Publish changes
                  </Button>
                )}
              </div>
            )}

            <WorkflowCanvas
              draft={draft}
              selected={selected}
              onSelect={setSelected}
              onChange={setDraft}
              sequencesById={sequencesById}
            />
          </div>

          <aside className="w-[380px] shrink-0 overflow-y-auto border-l border-line bg-surface">
            {selected.kind === "trigger" ? (
              <TriggerInspector draft={draft} onChange={setDraft} />
            ) : selected.kind === "step" && selectedStep ? (
              <BlockInspector
                step={selectedStep}
                sequences={sequences.data ?? []}
                canMoveUp={selectedIndex > 0}
                canMoveDown={selectedIndex < siblingCount - 1}
                onChange={(next) =>
                  setDraft({ ...draft, steps: updateStep(draft.steps, selected.path, next) })
                }
                onDelete={() => {
                  setDraft({ ...draft, steps: removeStep(draft.steps, selected.path) });
                  setSelected({ kind: "none" });
                }}
                onMove={(direction) => {
                  const moved = moveStep(draft.steps, selected.path, direction);
                  setDraft({ ...draft, steps: moved.steps });
                  setSelected({ kind: "step", path: moved.path });
                }}
                onClose={() => setSelected({ kind: "none" })}
              />
            ) : (
              <WorkflowOverview draft={draft} onChange={setDraft} onSelect={setSelected} />
            )}
          </aside>
        </div>
      ) : tab === "runs" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <RunList
              runs={runs.data ?? []}
              peopleById={peopleById}
              initialOpenId={highlightedRun}
              emptyHint={
                draft.enabled
                  ? "Nothing has triggered this workflow yet. Use Trigger workflow to try it on one person."
                  : "This workflow is disabled, so it will not run on its own. You can still use Trigger workflow."
              }
            />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <WorkflowSettings
            draft={draft}
            onChange={setDraft}
            enabled={draft.enabled}
            onEnabledChange={setEnabled}
            onDelete={() => setConfirmDelete(true)}
            busy={pending}
          />
        </div>
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete workflow"
        description={draft.name}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" loading={pending} onClick={remove}>
              Delete workflow
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          It stops running immediately. Past runs stay in the history until the server restarts.
        </p>
      </Modal>

      <TriggerDialog
        open={triggering}
        workflowId={id}
        people={people.data ?? []}
        onClose={() => setTriggering(false)}
        onRan={() => {
          void runs.refresh();
          setTab("runs");
        }}
      />
    </>
  );
}

function TriggerDialog({
  open, workflowId, people, onClose, onRan,
}: {
  open: boolean;
  workflowId: string;
  people: { id: string; name?: string; email: string }[];
  onClose: () => void;
  onRan: () => void;
}) {
  const [personId, setPersonId] = useState("");
  const [result, setResult] = useState<WorkflowRun | { skipped: string }>();
  const { run, pending, error } = useAction();

  const chosen = personId || people[0]?.id || "";

  const submit = async () => {
    const res = await run(() => api.workflows.runNow(workflowId, chosen));
    if (res) {
      setResult(res);
      onRan();
    }
  };

  const close = () => {
    setResult(undefined);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Trigger workflow"
      description="Runs the published version for one person, even while the workflow is disabled."
      footer={
        result ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" loading={pending} disabled={!chosen} onClick={submit}>
              Run workflow
            </Button>
          </>
        )
      }
    >
      {error && <ErrorNote className="mb-3">{error}</ErrorNote>}

      {result ? (
        "skipped" in result ? (
          <p className="text-[13px] leading-relaxed text-muted">
            <Badge tone="warn">Skipped</Badge> {result.skipped}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-ink">
              <Badge tone={result.status === "failed" ? "bad" : "good"}>{result.status}</Badge>{" "}
              Finished with {result.log.length} log {result.log.length === 1 ? "line" : "lines"}.
            </p>
            <ol className="max-h-56 overflow-y-auto rounded-lg border border-line">
              {result.log.map((line, i) => (
                <li
                  key={i}
                  className="border-b border-line px-3 py-1.5 font-mono text-[12px] text-ink last:border-b-0"
                >
                  {line}
                </li>
              ))}
            </ol>
            {result.error && (
              <p className="rounded-lg bg-bad-soft px-3 py-2 font-mono text-[12px] text-bad">
                {result.error}
              </p>
            )}
          </div>
        )
      ) : people.length === 0 ? (
        <p className="text-[13px] text-muted">Add a person first, then run the workflow on them.</p>
      ) : (
        <Select aria-label="Person" value={chosen} onChange={(e) => setPersonId(e.target.value)}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {displayName(p)}
            </option>
          ))}
        </Select>
      )}
    </Modal>
  );
}
