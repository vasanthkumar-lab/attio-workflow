import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SequencesService } from './sequences/sequences.service';
import { WorkflowsService } from './workflows/workflows.service';

/**
 * SEED=1 creates the same setup as the Attio screen:
 * the "Two-Step Email Follow-Up for People" sequence and a speed-to-lead workflow.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Seed');

  constructor(
    private readonly sequences: SequencesService,
    private readonly workflows: WorkflowsService,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.SEED !== '1') return;

    const seq = await this.sequences.create({
      name: 'Two-Step Email Follow-Up for People',
      enabled: true,
      defaultSender: process.env.DEFAULT_SENDER ?? 'team@hyring.example',
      signature: 'Best,\nThe Hyring team',
      delivery: { timezone: 'Asia/Kolkata', startHour: 9, endHour: 17, businessDaysOnly: true },
      email: { unsubscribeText: 'Stop hearing from me', threadEmails: true, includeSignature: true },
      exitCriteria: {
        onReply: true,
        when: [{ field: 'stage', op: 'in', value: ['meeting_booked', 'customer'] }],
      },
      steps: [
        {
          waitBusinessDays: 0,
          subject: 'Hiring at {{company | your team}}?',
          body: 'Hi {{firstName | there}},\n\nI noticed {{company | your team}} is growing. Hyring helps teams screen candidates faster.\nWorth a 15-minute chat this week?',
        },
        {
          waitBusinessDays: 3,
          body: 'Hi {{firstName | there}}, just bringing this back to the top of your inbox. Happy to share a quick demo.',
        },
      ],
    });

    const wf = await this.workflows.create({
      name: 'Speed to lead',
      enabled: true,
      trigger: { event: 'person.created' },
      steps: [
        { type: 'enrich' },
        {
          type: 'score',
          rules: [
            { condition: { field: 'domain', op: 'isNotEmpty' }, points: 25 },
            { condition: { any: ['hr', 'talent', 'recruit', 'people', 'founder', 'ceo', 'cto'].map((w) => ({ field: 'title', op: 'contains', value: w })) }, points: 30 },
            { condition: { any: ['saas', 'software', 'staffing', 'technology'].map((w) => ({ field: 'industry', op: 'contains', value: w })) }, points: 20 },
            { condition: { field: 'companySize', op: 'gte', value: 50 }, points: 15 },
            { condition: { field: 'company', op: 'isNotEmpty' }, points: 10 },
          ],
        },
        {
          type: 'if',
          label: 'score >= 50',
          condition: { field: 'score', op: 'gte', value: 50 },
          then: [
            { type: 'update', fields: { segment: 'priority' } },
            { type: 'enroll', sequenceId: seq.id },
          ],
          else: [
            { type: 'update', fields: { segment: 'nurture' } },
            { type: 'addTag', tag: 'low-fit' },
          ],
        },
      ],
    });

    const replied = await this.workflows.create({
      name: 'Reply received -> mark contacted',
      enabled: true,
      trigger: { event: 'enrollment.replied' },
      steps: [{ type: 'update', fields: { stage: 'contacted' } }, { type: 'addTag', tag: 'replied' }],
    });

    this.logger.log(`seeded sequence ${seq.id}, workflows ${wf.id} and ${replied.id}`);
  }
}