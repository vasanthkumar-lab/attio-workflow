import { Person } from '../../people/person.entity';
import { Workflow, WorkflowRun, WorkflowStep } from '../workflow.types';

export interface StepContext {
  person: Person; // working copy; the engine saves it after the run
  workflow: Workflow;
  run: WorkflowRun;
  log: (message: string) => void;
  /** Runs nested steps (used by the "if" step). */
  runSteps: (steps: WorkflowStep[]) => Promise<void>;
  /** Saves the working copy of the person now (used before enrolling). */
  save: () => Promise<void>;
}

export interface StepHandler<T extends WorkflowStep = WorkflowStep> {
  readonly type: T['type'];
  execute(step: T, ctx: StepContext): Promise<void>;
}

export const STEP_HANDLERS = Symbol('STEP_HANDLERS');