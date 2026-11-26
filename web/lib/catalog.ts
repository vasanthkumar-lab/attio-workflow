import type { Operator, StepType, TriggerEvent, WorkflowStep } from "./types";

// ------------------------------------------------------------- person fields

export type FieldKind = "text" | "number" | "select" | "list" | "date";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  /** Offered in the {x} variable menu inside email steps. */
  variable?: boolean;
  options?: string[];
  hint?: string;
}

export const STAGES = ["lead", "contacted", "meeting_booked", "customer", "closed_lost"];
export const SEGMENTS = ["priority", "nurture"];

export const PERSON_FIELDS: FieldDef[] = [
  { key: "email", label: "Email", kind: "text", variable: true },
  { key: "name", label: "Name", kind: "text", variable: true },
  {
    key: "firstName",
    label: "First name",
    kind: "text",
    variable: true,
    hint: "Falls back to the first word of Name",
  },
  { key: "title", label: "Job title", kind: "text", variable: true },
  { key: "company", label: "Company", kind: "text", variable: true },
  { key: "domain", label: "Domain", kind: "text", variable: true },
  { key: "industry", label: "Industry", kind: "text", variable: true },
  { key: "companySize", label: "Company size", kind: "number", variable: true },
  { key: "location", label: "Location", kind: "text", variable: true },
  { key: "description", label: "Description", kind: "text", variable: true },
  { key: "linkedinUrl", label: "LinkedIn URL", kind: "text", variable: true },
  { key: "score", label: "Score", kind: "number", variable: true },
  { key: "segment", label: "Segment", kind: "select", options: SEGMENTS, variable: true },
  { key: "stage", label: "Stage", kind: "select", options: STAGES, variable: true },
  {
    key: "owner",
    label: "Owner",
    kind: "text",
    variable: true,
    hint: "Email of the rep who sends for this person",
  },
  { key: "tags", label: "Tags", kind: "list" },
  { key: "enrichedAt", label: "Enriched at", kind: "date" },
  { key: "createdAt", label: "Created at", kind: "date" },
];

export const fieldDef = (key: string): FieldDef | undefined =>
  PERSON_FIELDS.find((f) => f.key === key);

export const fieldLabel = (key: string): string => fieldDef(key)?.label ?? key;

/** Fields a workflow "Update record" block is allowed to write (the API protects the rest). */
export const WRITABLE_FIELDS = PERSON_FIELDS.filter(
  (f) => !["email", "createdAt", "enrichedAt", "tags"].includes(f.key),
);

// ---------------------------------------------------------------- operators

export interface OperatorDef {
  op: Operator;
  label: string;
  /** false when the operator takes no value, e.g. "is empty" */
  takesValue: boolean;
  kinds: FieldKind[];
}

export const OPERATORS: OperatorDef[] = [
  { op: "eq", label: "is", takesValue: true, kinds: ["text", "number", "select", "date", "list"] },
  { op: "neq", label: "is not", takesValue: true, kinds: ["text", "number", "select", "date", "list"] },
  { op: "contains", label: "contains", takesValue: true, kinds: ["text", "select", "list"] },
  { op: "in", label: "is any of", takesValue: true, kinds: ["text", "select", "number"] },
  { op: "gt", label: "greater than", takesValue: true, kinds: ["number", "date"] },
  { op: "gte", label: "is at least", takesValue: true, kinds: ["number", "date"] },
  { op: "lt", label: "less than", takesValue: true, kinds: ["number", "date"] },
  { op: "lte", label: "is at most", takesValue: true, kinds: ["number", "date"] },
  {
    op: "isEmpty",
    label: "is empty",
    takesValue: false,
    kinds: ["text", "number", "select", "date", "list"],
  },
  {
    op: "isNotEmpty",
    label: "is not empty",
    takesValue: false,
    kinds: ["text", "number", "select", "date", "list"],
  },
];

export const operatorDef = (op: Operator): OperatorDef =>
  OPERATORS.find((o) => o.op === op) ?? OPERATORS[0];

export const operatorsFor = (kind: FieldKind): OperatorDef[] =>
  OPERATORS.filter((o) => o.kinds.includes(kind));

// ----------------------------------------------------------------- triggers

export interface TriggerDef {
  event: TriggerEvent;
  label: string;
  description: string;
  category: string;
  /** person.updated can narrow to specific changed fields. */
  supportsFields?: boolean;
}

export const TRIGGERS: TriggerDef[] = [
  {
    event: "person.created",
    label: "Record created",
    description: "Runs when a person is added to the CRM, by the API, an import or a form.",
    category: "Record",
  },
  {
    event: "person.updated",
    label: "Record updated",
    description: "Runs when a person's attributes change. Narrow it to the fields you care about.",
    category: "Record",
    supportsFields: true,
  },
  {
    event: "enrollment.replied",
    label: "Reply received",
    description: "Runs when someone replies to an email sent by a sequence.",
    category: "Sequence",
  },
  {
    event: "enrollment.completed",
    label: "Sequence completed",
    description: "Runs when someone reaches the end of a sequence without replying.",
    category: "Sequence",
  },
  {
    event: "manual",
    label: "Manual run",
    description: "Never runs on its own. Start it yourself with Trigger workflow.",
    category: "Utilities",
  },
];

export const triggerDef = (event: TriggerEvent): TriggerDef =>
  TRIGGERS.find((t) => t.event === event) ?? TRIGGERS[0];

// -------------------------------------------------------------------- blocks

export type BlockTone = "violet" | "accent" | "good" | "warn" | "muted";

export interface BlockDef {
  type: StepType;
  label: string;
  description: string;
  category: string;
  tone: BlockTone;
  /** A fresh step of this type, used when the block is added to the canvas. */
  create: () => WorkflowStep;
}

export const BLOCKS: BlockDef[] = [
  {
    type: "enrich",
    label: "Enrich record",
    description: "Fill in company, domain, industry and size from the person's email address.",
    category: "Data",
    tone: "violet",
    create: () => ({ type: "enrich" }),
  },
  {
    type: "score",
    label: "Score record",
    description: "Add points for every rule that matches and save the total to Score.",
    category: "Data",
    tone: "violet",
    create: () => ({
      type: "score",
      rules: [{ condition: { field: "company", op: "isNotEmpty" }, points: 10 }],
    }),
  },
  {
    type: "if",
    label: "If",
    description: "Split the run into a True path and a False path.",
    category: "Condition",
    tone: "warn",
    create: () => ({
      type: "if",
      label: "",
      condition: { field: "score", op: "gte", value: 50 },
      then: [],
      else: [],
    }),
  },
  {
    type: "update",
    label: "Update record",
    description: "Write values to the person's attributes.",
    category: "Record",
    tone: "accent",
    create: () => ({ type: "update", fields: {} }),
  },
  {
    type: "addTag",
    label: "Add tag",
    description: "Add a tag to the person, leaving existing tags in place.",
    category: "Record",
    tone: "accent",
    create: () => ({ type: "addTag", tag: "" }),
  },
  {
    type: "enroll",
    label: "Enroll in sequence",
    description: "Start the person on a sequence. Skipped if they are already in it or unsubscribed.",
    category: "Sequence",
    tone: "good",
    create: () => ({ type: "enroll", sequenceId: "" }),
  },
  {
    type: "webAgent",
    label: "Web agent",
    description: "Research the record on the web with an LLM and fill in the attributes you pick.",
    category: "Agents",
    tone: "violet",
    create: () => ({
      type: "webAgent",
      instruction:
        "Find this person's current job title and employer, and what the company does.",
      fields: ["title", "company", "industry"],
    }),
  },
  {
    type: "webhook",
    label: "Send HTTP request",
    description: "POST the person to an HTTPS URL, such as a Slack incoming webhook.",
    category: "Utilities",
    tone: "muted",
    create: () => ({ type: "webhook", url: "" }),
  },
];

/**
 * Attributes the Web agent may write. Mirrors AGENT_FIELDS in
 * server/src/agents/web-agent.service.ts, which rejects anything else.
 */
export const AGENT_FIELDS = [
  "name",
  "title",
  "company",
  "domain",
  "industry",
  "companySize",
  "location",
  "linkedinUrl",
  "description",
];

export const blockDef = (type: StepType): BlockDef =>
  BLOCKS.find((b) => b.type === type) ?? BLOCKS[0];

export const BLOCK_CATEGORIES = [
  "Agents",
  "Data",
  "Condition",
  "Record",
  "Sequence",
  "Utilities",
];

/** Tailwind classes per tone, so block colours stay consistent across canvas and library. */
export const TONE_CLASSES: Record<BlockTone, { chip: string; dot: string }> = {
  violet: { chip: "bg-violet-soft text-violet", dot: "bg-violet" },
  accent: { chip: "bg-accent-soft text-accent-ink", dot: "bg-accent" },
  good: { chip: "bg-good-soft text-good", dot: "bg-good" },
  warn: { chip: "bg-warn-soft text-warn", dot: "bg-warn" },
  muted: { chip: "bg-canvas text-muted", dot: "bg-faint" },
};

// -------------------------------------------------------- enrollment statuses

export type Tone = "good" | "warn" | "bad" | "muted" | "accent" | "violet";

export const ENROLLMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "good" },
  paused: { label: "Paused", tone: "warn" },
  completed: { label: "Completed", tone: "accent" },
  exited: { label: "Exited", tone: "muted" },
  unsubscribed: { label: "Unsubscribed", tone: "bad" },
  failed: { label: "Failed", tone: "bad" },
};

/** Wording offered for the opt-out line at the end of every sequence email. */
export const UNSUBSCRIBE_PHRASES = [
  "Stop hearing from me",
  "Not interested",
  "Stop reaching out",
  "Click here to unsubscribe",
  "Opt out",
  "Unsubscribe from email",
  "Unsubscribe",
];

export const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];
