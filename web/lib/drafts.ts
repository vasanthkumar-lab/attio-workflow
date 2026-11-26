import type {
  Sequence, SequenceInput, Workflow, WorkflowInput, WorkflowStep,
} from "./types";

const EMAIL = /^[^@\s]+@[^@\s]+$/;


export const DEFAULT_SENDER = "sales@hyring.com";

// ----------------------------------------------------------------- sequences

export function blankSequence(): SequenceInput {
  return {
    name: "Untitled Sequence",
    description: "",
    enabled: false,
    defaultSender: DEFAULT_SENDER,
    signature: "Best,\nThe team",
    steps: [
      {
        waitBusinessDays: 0,
        subject: "Quick question about {{company | your team}}",
        body:
          "Hi {{firstName | there}},\n\n" +
          "I came across {{company | your team}} and wanted to reach out.\n\n" +
          "Worth a 15-minute chat this week?",
      },
    ],
    delivery: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
      startHour: 9,
      endHour: 17,
      businessDaysOnly: true,
    },
    email: {
      unsubscribeText: "Stop hearing from me",
      threadEmails: true,
      includeSignature: true,
    },
    exitCriteria: { onReply: true, when: [] },
  };
}

export function toSequenceInput(sequence: Sequence): SequenceInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...input } = sequence;
  return structuredClone(input);
}

/** Mirrors server/src/sequences/sequence.validation.ts so problems surface before saving. */
export function validateSequence(input: SequenceInput): string[] {
  const problems: string[] = [];

  if (!input.name.trim()) problems.push("Give the sequence a name.");
  if (!EMAIL.test(input.defaultSender))
    problems.push("Sender settings: the mailbox must be an email address.");

  if (input.steps.length === 0) {
    problems.push("Add at least one email.");
  } else {
    if (!input.steps[0].subject?.trim()) problems.push("Email 1 needs a subject line.");
    input.steps.forEach((step, i) => {
      if (!step.body.trim()) problems.push(`Email ${i + 1} has no body.`);
      if (!Number.isInteger(step.waitBusinessDays) || step.waitBusinessDays < 0)
        problems.push(`Email ${i + 1} has an invalid wait.`);
    });
  }

  const { startHour, endHour, timezone } = input.delivery;
  if (!(Number.isInteger(startHour) && Number.isInteger(endHour) && startHour < endHour))
    problems.push("Delivery: the sending window must start before it ends.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    problems.push(`Delivery: "${timezone}" is not a valid time zone.`);
  }

  input.exitCriteria.when.forEach((condition, i) => {
    if ("field" in condition && !condition.field)
      problems.push(`Exit criteria ${i + 1} has no attribute selected.`);
  });

  return problems;
}

// ----------------------------------------------------------------- workflows

export function blankWorkflow(): WorkflowInput {
  return {
    name: "Untitled Workflow",
    enabled: false,
    trigger: { event: "person.created" },
    steps: [{ type: "enrich" }],
  };
}

export function toWorkflowInput(workflow: Workflow): WorkflowInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...input } = workflow;
  return structuredClone(input);
}

/** Mirrors server/src/workflows/workflow.validation.ts, plus a few editor-only checks. */
export function validateWorkflow(input: WorkflowInput): string[] {
  const problems: string[] = [];
  if (!input.name.trim()) problems.push("Give the workflow a name.");
  if (input.steps.length === 0) problems.push("Add at least one block after the trigger.");
  problems.push(...checkSteps(input.steps, ""));
  return problems;
}

/**
 * What is still missing on one block, or undefined when it is ready to run.
 * Drives both the publish check and the Checklist in the builder sidebar.
 */
export function stepProblem(step: WorkflowStep): string | undefined {
  switch (step.type) {
    case "enrich":
      return undefined;
    case "score":
      if (step.rules.length === 0) return "Add at least one scoring rule";
      if (step.rules.some((r) => typeof r.points !== "number" || Number.isNaN(r.points)))
        return "Every rule needs a number of points";
      return undefined;
    case "if":
      if (!step.condition) return "Set a condition";
      if (step.then.length === 0 && (step.else?.length ?? 0) === 0)
        return "Add a block to the True or False path";
      return undefined;
    case "update":
      return Object.keys(step.fields).length === 0
        ? "Choose at least one attribute to write"
        : undefined;
    case "addTag":
      return step.tag.trim() ? undefined : "Enter a tag";
    case "enroll":
      return step.sequenceId ? undefined : "Choose a sequence";
    case "webhook":
      return /^https:\/\//.test(step.url) ? undefined : "The URL must start with https://";
  }
}

function checkSteps(steps: WorkflowStep[], prefix: string): string[] {
  const problems: string[] = [];

  steps.forEach((step, i) => {
    const where = `${prefix}Block ${i + 1} (${step.type})`;
    const problem = stepProblem(step);
    if (problem) problems.push(`${where}: ${problem.toLowerCase()}.`);

    if (step.type === "if") {
      problems.push(...checkSteps(step.then, `${where} > True > `));
      problems.push(...checkSteps(step.else ?? [], `${where} > False > `));
    }
  });

  return problems;
}
