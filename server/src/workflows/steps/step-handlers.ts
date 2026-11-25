import { Injectable } from '@nestjs/common';
import { evaluate } from '../../common/conditions';
import { EnrichmentService } from '../../enrichment/enrichment.service';
import { SequencesService } from '../../sequences/sequences.service';
import { WorkflowStep } from '../workflow.types';
import { StepContext, StepHandler } from './step-handler';

type Of<T extends WorkflowStep['type']> = Extract<WorkflowStep, { type: T }>;

@Injectable()
export class EnrichStepHandler implements StepHandler<Of<'enrich'>> {
  readonly type = 'enrich';
  constructor(private readonly enrichment: EnrichmentService) {}

  async execute(_step: Of<'enrich'>, ctx: StepContext) {
    for (const line of await this.enrichment.enrich(ctx.person)) ctx.log(`enrich ${line}`);
    ctx.log(`enriched: company="${ctx.person.company ?? ''}" domain="${ctx.person.domain ?? ''}"`);
  }
}

/** Rule-based scoring. Each matching rule adds its points; result is clamped to 0-100. */
@Injectable()
export class ScoreStepHandler implements StepHandler<Of<'score'>> {
  readonly type = 'score';

  async execute(step: Of<'score'>, ctx: StepContext) {
    let score = 0;
    for (const rule of step.rules) if (evaluate(rule.condition, ctx.person)) score += rule.points;
    ctx.person.score = Math.max(0, Math.min(100, score));
    ctx.log(`score = ${ctx.person.score}`);
  }
}

@Injectable()
export class IfStepHandler implements StepHandler<Of<'if'>> {
  readonly type = 'if';

  async execute(step: Of<'if'>, ctx: StepContext) {
    const result = evaluate(step.condition, ctx.person);
    ctx.log(`if ${step.label ?? JSON.stringify(step.condition)} -> ${result}`);
    await ctx.runSteps(result ? step.then : step.else ?? []);
  }
}

const PROTECTED_FIELDS = new Set(['id', 'email', 'createdAt', 'updatedAt']);

@Injectable()
export class UpdateStepHandler implements StepHandler<Of<'update'>> {
  readonly type = 'update';

  async execute(step: Of<'update'>, ctx: StepContext) {
    for (const [key, value] of Object.entries(step.fields)) {
      if (PROTECTED_FIELDS.has(key)) {
        ctx.log(`update skipped protected field "${key}"`);
        continue;
      }
      (ctx.person as any)[key] = value;
      ctx.log(`set ${key} = ${JSON.stringify(value)}`);
    }
  }
}

@Injectable()
export class AddTagStepHandler implements StepHandler<Of<'addTag'>> {
  readonly type = 'addTag';

  async execute(step: Of<'addTag'>, ctx: StepContext) {
    if (!ctx.person.tags.includes(step.tag)) ctx.person.tags.push(step.tag);
    ctx.log(`tag "${step.tag}" added`);
  }
}

@Injectable()
export class EnrollStepHandler implements StepHandler<Of<'enroll'>> {
  readonly type = 'enroll';
  constructor(private readonly sequences: SequencesService) {}

  async execute(step: Of<'enroll'>, ctx: StepContext) {
    await ctx.save(); // so the sequence sees the newest enriched/scored data
    const r = await this.sequences.enroll(step.sequenceId, ctx.person.id, `workflow:${ctx.workflow.id}`);
    ctx.log(r.enrolled ? `enrolled in ${step.sequenceId}, first email at ${r.enrollment!.nextSendAt}` : `not enrolled: ${r.reason}`);
  }
}

/** POSTs a short message + the person to a URL, e.g. a Slack incoming webhook. */
@Injectable()
export class WebhookStepHandler implements StepHandler<Of<'webhook'>> {
  readonly type = 'webhook';

  async execute(step: Of<'webhook'>, ctx: StepContext) {
    const p = ctx.person;
    const res = await fetch(step.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        text: `${ctx.workflow.name}: ${p.name ?? p.email} (${p.company ?? 'unknown company'}) score ${p.score ?? '-'}`,
        person: p,
      }),
    });
    if (!res.ok) throw new Error(`webhook returned ${res.status}`);
    ctx.log(`webhook sent (${res.status})`);
  }
}

export const ALL_STEP_HANDLERS = [
  EnrichStepHandler,
  ScoreStepHandler,
  IfStepHandler,
  UpdateStepHandler,
  AddTagStepHandler,
  EnrollStepHandler,
  WebhookStepHandler,
];