import type { WorkflowStep } from "./types";

/**
 * Workflow steps are a tree: an If block holds `then` and `else` lists of its own.
 *
 *   StepPath  points at one block     e.g. [2, "then", 0]
 *   ListPath  points at a list        e.g. [] (root) or [2, "then"]
 */
export type Segment = number | "then" | "else";
export type StepPath = Segment[];
export type ListPath = Segment[];

export const pathKey = (path: Segment[]) => path.join(".");
export const samePath = (a?: Segment[], b?: Segment[]) =>
  Boolean(a && b) && pathKey(a!) === pathKey(b!);

function branchOf(step: WorkflowStep, branch: Segment): WorkflowStep[] {
  if (step.type !== "if") return [];
  return branch === "then" ? step.then : step.else ?? [];
}

export function getStep(steps: WorkflowStep[], path: StepPath): WorkflowStep | undefined {
  if (path.length === 0) return undefined;
  const [index, ...rest] = path;
  const node = steps[index as number];
  if (!node || rest.length === 0) return node;
  const [branch, ...tail] = rest;
  return getStep(branchOf(node, branch), tail);
}

export function getList(steps: WorkflowStep[], path: ListPath): WorkflowStep[] {
  if (path.length === 0) return steps;
  const [index, branch, ...rest] = path;
  const node = steps[index as number];
  if (!node) return [];
  return getList(branchOf(node, branch), rest);
}

function withBranch(step: WorkflowStep, branch: Segment, list: WorkflowStep[]): WorkflowStep {
  if (step.type !== "if") return step;
  return branch === "then" ? { ...step, then: list } : { ...step, else: list };
}

export function updateStep(
  steps: WorkflowStep[],
  path: StepPath,
  next: WorkflowStep,
): WorkflowStep[] {
  const [index, ...rest] = path;
  return steps.map((step, i) => {
    if (i !== index) return step;
    if (rest.length === 0) return next;
    const [branch, ...tail] = rest;
    return withBranch(step, branch, updateStep(branchOf(step, branch), tail, next));
  });
}

export function removeStep(steps: WorkflowStep[], path: StepPath): WorkflowStep[] {
  const [index, ...rest] = path;
  if (rest.length === 0) return steps.filter((_, i) => i !== index);
  return steps.map((step, i) => {
    if (i !== index) return step;
    const [branch, ...tail] = rest;
    return withBranch(step, branch, removeStep(branchOf(step, branch), tail));
  });
}

/** Inserts `step` into the list at `listPath`, at position `index`. */
export function insertStep(
  steps: WorkflowStep[],
  listPath: ListPath,
  index: number,
  step: WorkflowStep,
): WorkflowStep[] {
  if (listPath.length === 0) {
    const next = [...steps];
    next.splice(index, 0, step);
    return next;
  }
  const [i, branch, ...rest] = listPath;
  return steps.map((node, idx) => {
    if (idx !== i) return node;
    return withBranch(node, branch, insertStep(branchOf(node, branch), rest, index, step));
  });
}

/** Moves a block up or down within its own list. Returns the steps unchanged at the edges. */
export function moveStep(
  steps: WorkflowStep[],
  path: StepPath,
  direction: -1 | 1,
): { steps: WorkflowStep[]; path: StepPath } {
  const listPath = path.slice(0, -1);
  const index = path[path.length - 1] as number;
  const list = getList(steps, listPath);
  const target = index + direction;
  if (target < 0 || target >= list.length) return { steps, path };

  const moved = list[index];
  const without = list.filter((_, i) => i !== index);
  without.splice(target, 0, moved);

  const nextSteps = replaceList(steps, listPath, without);
  return { steps: nextSteps, path: [...listPath, target] };
}

export function replaceList(
  steps: WorkflowStep[],
  listPath: ListPath,
  list: WorkflowStep[],
): WorkflowStep[] {
  if (listPath.length === 0) return list;
  const [i, branch, ...rest] = listPath;
  return steps.map((node, idx) => {
    if (idx !== i) return node;
    return withBranch(node, branch, replaceList(branchOf(node, branch), rest, list));
  });
}

/** Total number of blocks, branches included - shown on the workflow list. */
export function countSteps(steps: WorkflowStep[]): number {
  return steps.reduce(
    (n, step) =>
      n + 1 + (step.type === "if" ? countSteps(step.then) + countSteps(step.else ?? []) : 0),
    0,
  );
}
