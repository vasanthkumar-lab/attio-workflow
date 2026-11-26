import { Injectable } from '@nestjs/common';
import { AgentField, WebAgentService } from '../../agents/web-agent.service';
import { evaluate } from '../../common/conditions';
import { setIfEmpty } from '../../enrichment/enrichment.provider';
import { EnrichmentService } from '../../enrichment/enrichment.service';
import { Person } from '../../people/person.entity';
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

/**
 * Researches the record on the web with an LLM and writes back the attributes the
 * block selected. Existing values are kept unless the block opts into overwriting,
 * so the agent fills gaps rather than second-guessing what a human already entered.
 */
@Injectable()
export class WebAgentStepHandler implements StepHandler<Of<'webAgent'>> {
  readonly type = 'webAgent';
  constructor(private readonly agent: WebAgentService) {}

  async execute(step: Of<'webAgent'>, ctx: StepContext) {
    if (!this.agent.configured) {
      ctx.log('web agent: OPENROUTER_API_KEY not set, skipped');
      return;
    }

    const findings = await this.agent.research(
      ctx.person,
      step.instruction,
      step.fields as AgentField[],
    );

    if (findings.servedBy) ctx.log(`agent model: ${findings.servedBy}`);

    let written = 0;
    for (const [key, value] of Object.entries(findings.values)) {
      const field = key as keyof Person;
      const before = ctx.person[field];

      if (step.overwrite) (ctx.person as unknown as Record<string, unknown>)[key] = value;
      else setIfEmpty(ctx.person, field, value as never);

      if (ctx.person[field] !== before) {
        written += 1;
        ctx.log(`agent set ${key} = ${JSON.stringify(ctx.person[field])}`);
      } else {
        ctx.log(`agent skipped ${key}, already ${JSON.stringify(before)}`);
      }
    }

    if (!written && !Object.keys(findings.values).length) ctx.log('agent found nothing to add');
    if (findings.notes) ctx.log(`agent note: ${findings.notes}`);
    for (const source of findings.sources) ctx.log(`agent source: ${source}`);
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
  WebAgentStepHandler,
];