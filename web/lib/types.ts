/** Mirrors the NestJS API types in server/src. Keep in sync when the API changes. */

// ----------------------------------------------------------------- conditions

export type Operator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "contains" | "in" | "isEmpty" | "isNotEmpty";

export type LeafCondition = { field: string; op: Operator; value?: unknown };
export type GroupCondition = { all: Condition[] } | { any: Condition[] };
export type Condition = LeafCondition | GroupCondition;

export const isGroup = (c: Condition): c is GroupCondition => "all" in c || "any" in c;
export const groupKey = (c: GroupCondition): "all" | "any" => ("all" in c ? "all" : "any");

// -------------------------------------------------------------------- people

export interface Person {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  title?: string;
  company?: string;
  domain?: string;
  description?: string;
  industry?: string;
  companySize?: number;
  location?: string;
  linkedinUrl?: string;
  score?: number;
  segment?: string;
  owner?: string;
  stage: string;
  tags: string[];
  enrichedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonInput {
  email: string;
  name?: string;
  title?: string;
  company?: string;
  industry?: string;
  companySize?: number;
  location?: string;
  owner?: string;
  stage?: string;
  tags?: string[];
}

// ----------------------------------------------------------------- sequences

export interface SequenceStep {
  waitBusinessDays: number;
  subject?: string;
  body: string;
}

export interface DeliverySettings {
  timezone: string;
  startHour: number;
  endHour: number;
  businessDaysOnly: boolean;
}

export interface EmailSettings {
  unsubscribeText: string;
  threadEmails: boolean;
  includeSignature: boolean;
}

export interface ExitCriteria {
  onReply: boolean;
  when: Condition[];
}

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  steps: SequenceStep[];
  delivery: DeliverySettings;
  email: EmailSettings;
  exitCriteria: ExitCriteria;
  defaultSender: string;
  signature?: string;
  createdAt: string;
  updatedAt: string;
}

/** The body accepted by POST /sequences and PUT /sequences/:id. */
export type SequenceInput = Omit<Sequence, "id" | "createdAt" | "updatedAt">;

export type EnrollmentStatus =
  | "active" | "paused" | "completed" | "exited" | "unsubscribed" | "failed";

export interface SentEmail {
  step: number;
  subject: string;
  messageId: string;
  sentAt: string;
  /** The rendered body, after templating. Absent on emails sent before we kept it. */
  body?: string;
}

/** A reply from the lead. */
export interface ReceivedEmail {
  messageId: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  inReplyTo?: string;
}

export interface ReplyInput {
  body?: string;
  from?: string;
  subject?: string;
  receivedAt?: string;
}

export interface Enrollment {
  id: string;
  sequenceId: string;
  personId: string;
  sender: string;
  status: EnrollmentStatus;
  currentStep: number;
  nextSendAt: string;
  exitReason?: string;
  replied: boolean;
  threadMessageId?: string;
  firstSubject?: string;
  sent: SentEmail[];
  received: ReceivedEmail[];
  failures: number;
  lastError?: string;
  enrolledBy: string;
  enrolledAt: string;
  updatedAt: string;
}

export interface EnrollResult {
  personId: string;
  enrolled: boolean;
  enrollment?: Enrollment;
  reason?: string;
}

export interface SequenceStats {
  total: number;
  byStatus: Partial<Record<EnrollmentStatus, number>>;
  emailsSent: number;
  replyRate: string;
}

// ----------------------------------------------------------------- workflows

export type ScoreRule = { condition: Condition; points: number };

export interface CanvasPosition {
  x: number;
  y: number;
}

/**
 * Where the block sits on the builder canvas. Purely visual - execution order comes from
 * the order of the steps array, never from the coordinates.
 */
export interface Positioned {
  position?: CanvasPosition;
}

export type WorkflowStep = Positioned &
  (
    | { type: "enrich" }
    | { type: "score"; rules: ScoreRule[] }
    | { type: "if"; label?: string; condition: Condition; then: WorkflowStep[]; else?: WorkflowStep[] }
    | { type: "update"; fields: Record<string, unknown> }
    | { type: "addTag"; tag: string }
    | { type: "enroll"; sequenceId: string }
    | { type: "webhook"; url: string }
    | { type: "webAgent"; instruction: string; fields: string[]; overwrite?: boolean }
  );

export type StepType = WorkflowStep["type"];

export type TriggerEvent =
  | "person.created" | "person.updated"
  | "enrollment.replied" | "enrollment.completed"
  | "manual";

export interface WorkflowTrigger extends Positioned {
  event: TriggerEvent;
  fields?: string[];
  condition?: Condition;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export type WorkflowInput = Omit<Workflow, "id" | "createdAt" | "updatedAt">;

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  personId: string;
  trigger: string;
  status: "running" | "completed" | "failed";
  log: string[];
  error?: string;
  startedAt: string;
  finishedAt?: string;
}
