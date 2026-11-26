import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { evaluate } from '../common/conditions';
import { CrmEvent, Events } from '../common/events';
import { newId } from '../common/id';
import { PeopleService } from '../people/people.service';
import { STEP_HANDLERS, StepContext, StepHandler } from './steps/step-handler';
import { Workflow, WorkflowRun, WorkflowStep } from './workflow.types';
import { WorkflowsRepository } from './workflows.repository';

const MAX_STEPS_PER_RUN = 200; // guards against runaway branches

/**
 * Listens for CRM events, finds enabled workflows with a matching trigger,
 * and executes their steps. Every run is recorded with a step-by-step log.
 */
@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);
  private readonly handlers: Map<string, StepHandler>;

  constructor(
    private readonly repo: WorkflowsRepository,
    private readonly people: PeopleService,
    @Inject(STEP_HANDLERS) handlers: StepHandler[],
  ) {
    this.handlers = new Map(handlers.map((h) => [h.type, h]));
  }

  @OnEvent(Events.PersonCreated, { async: true })
  onPersonCreated(ev: CrmEvent) { return this.dispatch(Events.PersonCreated, ev); }

  @OnEvent(Events.PersonUpdated, { async: true })
  onPersonUpdated(ev: CrmEvent) { return this.dispatch(Events.PersonUpdated, ev); }

  @OnEvent(Events.EnrollmentReplied, { async: true })
  onReplied(ev: CrmEvent) { return this.dispatch(Events.EnrollmentReplied, ev); }

  @OnEvent(Events.EnrollmentCompleted, { async: true })
  onCompleted(ev: CrmEvent) { return this.dispatch(Events.EnrollmentCompleted, ev); }

  private async dispatch(event: string, ev: CrmEvent) {
    try {
      for (const wf of await this.repo.findByEvent(event)) {
        if (event === Events.PersonUpdated && wf.trigger.fields?.length && !wf.trigger.fields.some((f) => ev.changedFields?.includes(f))) {
          continue;
        }
        await this.run(wf, ev.personId, event);
      }
    } catch (err: any) {
      this.logger.error(`dispatch ${event} failed: ${err?.message}`);
    }
  }

  /** Runs one workflow for one person. Also used by the "Run now" endpoint. */
  async run(wf: Workflow, personId: string, trigger: string): Promise<WorkflowRun | undefined> {
    const person = await this.people.get(personId);
    if (wf.trigger.condition && !evaluate(wf.trigger.condition, person)) return undefined; // filtered out

    const run: WorkflowRun = {
      id: newId('run'),
      workflowId: wf.id,
      workflowName: wf.name,
      personId,
      trigger,
      status: 'running',
      log: [],
      startedAt: new Date().toISOString(),
    };
    await this.repo.saveRun(run);

    let stepsRun = 0;
    const ctx: StepContext = {
      person,
      workflow: wf,
      run,
      log: (m) => run.log.push(`${new Date().toISOString().slice(11, 19)} ${m}`),
      save: async () => { Object.assign(person, await this.people.saveFromAutomation(person)); },
      runSteps: async (steps: WorkflowStep[]) => {
        for (const step of steps) {
          if (++stepsRun > MAX_STEPS_PER_RUN) throw new Error(`more than ${MAX_STEPS_PER_RUN} steps in one run`);
          const handler = this.handlers.get(step.type);
          if (!handler) throw new Error(`no handler for step type "${step.type}"`);
          await handler.execute(step as never, ctx);
        }
      },
    };

    ctx.log(`trigger "${trigger}" for ${person.email}`);
    try {
      await ctx.runSteps(wf.steps);
      await ctx.save();
      run.status = 'completed';
    } catch (err: any) {
      run.status = 'failed';
      run.error = err?.message ?? String(err);
      ctx.log(`failed: ${run.error}`);
      await ctx.save().catch(() => undefined); // keep whatever was done before the failure
      this.logger.warn(`workflow "${wf.name}" failed for ${person.email}: ${run.error}`);
    }
    run.finishedAt = new Date().toISOString();
    return this.repo.saveRun(run);
  }
}