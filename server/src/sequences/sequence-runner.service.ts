import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { evaluate } from '../common/conditions';
import { CrmEvent, Events } from '../common/events';
import { missingFields, renderTemplate } from '../common/template';
import { MAIL_SENDER, MailSender } from '../email/mail-sender';
import { PeopleService } from '../people/people.service';
import { Enrollment } from './sequence.types';
import { FAST_DEMO, nextWindowTime, scheduleStep } from './sequence-timing';
import { SequencesRepository } from './sequences.repository';

const MAX_FAILURES = 5;

/**
 * The scheduler. Every tick it finds enrollments whose next email is due and sends them.
 * Order of checks for each one: still active? -> sequence enabled? -> exit criteria? ->
 * inside sending window? -> render -> send -> schedule next step.
 */
@Injectable()
export class SequenceRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SequenceRunnerService.name);
  private readonly baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
  private running = false;

  constructor(
    private readonly repo: SequencesRepository,
    private readonly people: PeopleService,
    private readonly scheduler: SchedulerRegistry,
    private readonly events: EventEmitter2,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
  ) {}

  onModuleInit() {
    const ms = Number(process.env.SEQUENCE_TICK_MS ?? (FAST_DEMO ? 2000 : 30000));
    this.scheduler.addInterval('sequence-runner', setInterval(() => void this.tick(), ms));
    this.logger.log(`sequence runner checking every ${ms / 1000}s${FAST_DEMO ? ' (FAST_DEMO: 1 business day = 10s)' : ''}`);
  }

  onModuleDestroy() {
    this.scheduler.deleteInterval('sequence-runner');
  }

  /** Public so you can call it from a test or a cron job instead of the interval. */
  async tick(now = new Date()) {
    if (this.running) return; // previous tick still sending
    this.running = true;
    try {
      for (const e of await this.repo.findDue(now)) {
        await this.process(e.id, now).catch((err) => this.logger.error(`enrollment ${e.id}: ${err?.message}`));
      }
    } finally {
      this.running = false;
    }
  }

  private async process(enrollmentId: string, now: Date) {
    // Re-read: it may have been replied to, paused or unsubscribed since findDue().
    const e = await this.repo.findEnrollment(enrollmentId);
    if (!e || e.status !== 'active') return;
    const seq = await this.repo.findSequence(e.sequenceId);
    if (!seq) return this.fail(e, 'sequence deleted', true);
    if (!seq.enabled) return; // stays due; sends once the sequence is enabled again

    const person = await this.people.get(e.personId);

    // Exit criteria are checked with fresh data right before every send.
    if (seq.exitCriteria.onReply && e.replied) return this.exit(e, 'replied');
    if (seq.exitCriteria.when.some((c) => evaluate(c, person))) return this.exit(e, 'matched exit criteria');

    // Never send outside the window (e.g. the server was down overnight and catches up at 2 AM).
    const allowedAt = nextWindowTime(seq, now);
    if (allowedAt > now) {
      e.nextSendAt = allowedAt.toISOString();
      await this.repo.saveEnrollment(e);
      return;
    }

    const step = seq.steps[e.currentStep];
    const isFollowUp = e.currentStep > 0;
    const data = { ...person, firstName: person.firstName ?? person.name?.split(' ')[0] };

    const subjectTemplate = seq.email.threadEmails && isFollowUp ? `Re: ${e.firstSubject}` : step.subject ?? `Re: ${e.firstSubject}`;
    const missing = missingFields(`${subjectTemplate}\n${step.body}`, data);
    if (missing.length) {
      // Pause instead of sending "Hi ," to a real person. A human can fix the record and resume.
      e.status = 'paused';
      e.lastError = `missing data: ${missing.join(', ')} (add a value or a {{field | fallback}})`;
      await this.repo.saveEnrollment(e);
      this.logger.warn(`${person.email}: paused, ${e.lastError}`);
      return;
    }

    const subject = renderTemplate(subjectTemplate, data);
    const unsubscribeUrl = `${this.baseUrl}/unsubscribe/${e.id}`;
    let text = renderTemplate(step.body, data);
    if (seq.email.includeSignature && seq.signature) text += `\n\n${renderTemplate(seq.signature, data)}`;
    text += `\n\n${seq.email.unsubscribeText}: ${unsubscribeUrl}`;

    let messageId: string;
    try {
      messageId = await this.mail.send({
        from: e.sender,
        to: person.email,
        subject,
        text,
        inReplyTo: seq.email.threadEmails && isFollowUp ? e.threadMessageId : undefined,
        unsubscribeUrl,
      });
    } catch (err: any) {
      // Retry with backoff: 5, 10, 15... minutes. Give up after MAX_FAILURES.
      e.failures += 1;
      e.lastError = err?.message ?? String(err);
      if (e.failures >= MAX_FAILURES) return this.fail(e, `send failed ${e.failures} times: ${e.lastError}`);
      e.nextSendAt = new Date(now.getTime() + e.failures * 5 * 60_000).toISOString();
      await this.repo.saveEnrollment(e);
      return;
    }

    e.sent.push({ step: e.currentStep, subject, messageId, sentAt: now.toISOString() });
    if (!isFollowUp) {
      e.threadMessageId = messageId;
      e.firstSubject = subject;
    }
    e.failures = 0;
    e.lastError = undefined;
    e.currentStep += 1;

    if (e.currentStep >= seq.steps.length) {
      e.status = 'completed';
      e.exitReason = 'all steps sent';
      await this.repo.saveEnrollment(e);
      this.events.emit(Events.EnrollmentCompleted, { personId: e.personId, enrollmentId: e.id, sequenceId: seq.id } satisfies CrmEvent);
      return;
    }
    e.nextSendAt = scheduleStep(seq, now, seq.steps[e.currentStep].waitBusinessDays).toISOString();
    await this.repo.saveEnrollment(e);
  }

  private async exit(e: Enrollment, reason: string) {
    e.status = 'exited';
    e.exitReason = reason;
    await this.repo.saveEnrollment(e);
  }

  private async fail(e: Enrollment, reason: string, terminal = false) {
    e.status = 'failed';
    e.lastError = reason;
    if (terminal) e.exitReason = reason;
    await this.repo.saveEnrollment(e);
    this.logger.error(`enrollment ${e.id} failed: ${reason}`);
  }
}