import { Condition } from '../common/conditions';
import { EventName } from '../common/events';

/**
 * Workflows are stored as JSON, so they can be built from a UI (like Attio's builder)
 * and saved through the API without code changes.
 */
/**
 * Where a block sits on the builder canvas. Stored so a layout survives a reload, but
 * never read by the engine: execution order comes from the order of the steps array.
 */
export interface CanvasPosition {
  x: number;
  y: number;
}

export type WorkflowStep = { position?: CanvasPosition } & (
  | { type: 'enrich' }
  | { type: 'score'; rules: { condition: Condition; points: number }[] }
  | { type: 'if'; label?: string; condition: Condition; then: WorkflowStep[]; else?: WorkflowStep[] }
  | { type: 'update'; fields: Record<string, unknown> }
  | { type: 'addTag'; tag: string }
  | { type: 'enroll'; sequenceId: string }
  | { type: 'webhook'; url: string } // e.g. Slack incoming webhook to alert the team
  /** Researches the record on the web with an LLM and fills in the chosen attributes. */
  | { type: 'webAgent'; instruction: string; fields: string[]; overwrite?: boolean }
);

export interface WorkflowTrigger {
  /** Canvas position of the trigger block. Visual only. */
  position?: CanvasPosition;
  event: EventName | 'manual';
  /** person.updated only: run only when one of these fields changed. */
  fields?: string[];
  /** Optional filter: run only for people matching this condition. */
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

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  personId: string;
  trigger: string;
  status: 'running' | 'completed' | 'failed';
  log: string[];
  error?: string;
  startedAt: string;
  finishedAt?: string;
}