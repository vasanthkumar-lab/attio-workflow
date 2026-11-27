import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { evaluate } from '../common/conditions';
import { CrmEvent, Events } from '../common/events';
import { newId } from '../common/id';
import { PeopleService } from '../people/people.service';
import { Enrollment, EnrollmentStatus, ReplyInput, Sequence } from './sequence.types';
import { scheduleStep } from './sequence-timing';
import { validateSequenceInput } from './sequence.validation';
import { SequencesRepository } from './sequences.repository';

export interface EnrollResult {
  personId: string;
  enrolled: boolean;
  enrollment?: Enrollment;
  reason?: string;
}

@Injectable()
export class SequencesService {
  private readonly logger = new Logger(SequencesService.name);

  constructor(
    private readonly repo: SequencesRepository,
    private readonly people: PeopleService,
    private readonly events: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------- sequences

  private build(input: any, existing?: Sequence): Sequence {
    validateSequenceInput(input);
    const now = new Date().toISOString();
    return {
      id: existing?.id ?? newId('seq'),
      name: input.name.trim(),
      description: input.description,
      enabled: input.enabled ?? existing?.enabled ?? false,
      steps: input.steps.map((s: any) => ({ waitBusinessDays: s.waitBusinessDays ?? 0, subject: s.subject, body: s.body })),
      delivery: {
        timezone: input.delivery?.timezone ?? 'Asia/Kolkata',
        startHour: input.delivery?.startHour ?? 9,
        endHour: input.delivery?.endHour ?? 17,
        businessDaysOnly: input.delivery?.businessDaysOnly ?? true,
      },
      email: {
        unsubscribeText: input.email?.unsubscribeText ?? 'Stop hearing from me',
        threadEmails: input.email?.threadEmails ?? true,
        includeSignature: input.email?.includeSignature ?? true,
      },
      exitCriteria: { onReply: input.exitCriteria?.onReply ?? true, when: input.exitCriteria?.when ?? [] },
      defaultSender: input.defaultSender,
      signature: input.signature,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  create(input: any) { return this.repo.saveSequence(this.build(input)); }

  async update(id: string, input: any) {
    return this.repo.saveSequence(this.build(input, await this.get(id)));
  }

  async setEnabled(id: string, enabled: boolean) {
    const seq = await this.get(id);
    seq.enabled = enabled;
    seq.updatedAt = new Date().toISOString();
    return this.repo.saveSequence(seq);
  }

  async get(id: string): Promise<Sequence> {
    const s = await this.repo.findSequence(id);
    if (!s) throw new NotFoundException(`sequence ${id} not found`);
    return s;
  }

  list() { return this.repo.listSequences(); }

  /** Deleting a sequence exits everyone still in it, the way Attio does when you disable one. */
  async delete(id: string) {
    await this.get(id);
    for (const e of await this.repo.findEnrollments({ sequenceId: id })) {
      await this.finish(e, 'exited', 'sequence deleted');
    }
    await this.repo.deleteSequence(id);
    return { id, deleted: true };
  }

  // -------------------------------------------------------------- enrollments

  async enroll(sequenceId: string, personId: string, enrolledBy = 'api'): Promise<EnrollResult> {
    const seq = await this.get(sequenceId);
    const person = await this.people.get(personId);

    if (await this.repo.isSuppressed(person.email)) return { personId, enrolled: false, reason: 'unsubscribed' };
    const existing = await this.repo.findEnrollments({ sequenceId, personId });
    if (existing.some((e) => e.status === 'active' || e.status === 'paused')) {
      return { personId, enrolled: false, reason: 'already enrolled' };
    }
    const matched = seq.exitCriteria.when.find((c) => evaluate(c, person));
    if (matched) return { personId, enrolled: false, reason: 'already matches exit criteria' };

    const now = new Date();
    const enrollment = await this.repo.saveEnrollment({
      id: newId('enr'),
      sequenceId,
      personId,
      sender: person.owner ?? seq.defaultSender,
      status: 'active',
      currentStep: 0,
      nextSendAt: scheduleStep(seq, now, seq.steps[0].waitBusinessDays).toISOString(),
      replied: false,
      sent: [],
      received: [],
      failures: 0,
      enrolledBy,
      enrolledAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    return { personId, enrolled: true, enrollment };
  }

  async enrollMany(sequenceId: string, personIds: string[], enrolledBy = 'api') {
    const results: EnrollResult[] = [];
    for (const id of personIds) {
      try {
        results.push(await this.enroll(sequenceId, id, enrolledBy));
      } catch (e: any) {
        results.push({ personId: id, enrolled: false, reason: e?.message ?? 'error' });
      }
    }
    return results;
  }

  async getEnrollment(id: string) {
    const e = await this.repo.findEnrollment(id);
    if (!e) throw new NotFoundException(`enrollment ${id} not found`);
    return e;
  }

  listEnrollments(sequenceId?: string, status?: EnrollmentStatus, personId?: string) {
    return this.repo.findEnrollments({ sequenceId, status, personId });
  }

  private async finish(e: Enrollment, status: EnrollmentStatus, reason: string) {
    if (e.status !== 'active' && e.status !== 'paused') return e;
    e.status = status;
    e.exitReason = reason;
    return this.repo.saveEnrollment(e);
  }

  /**
   * Call this from your inbox sync (Gmail push / Microsoft Graph / IMAP) when a reply
   * arrives, passing the message so it lands in the thread. Without one we still flag
   * the enrollment, which is all this did before and all a human clicking a button can
   * honestly claim: somebody replied, go and read it in your mail client.
   */
  async markReplied(id: string, reply?: ReplyInput) {
    const e = await this.getEnrollment(id);
    const seq = await this.get(e.sequenceId);
    e.replied = true;
    // Enrollments created before replies were storable have no array.
    e.received ??= [];

    const body = reply?.body?.trim();
    if (body) {
      const person = await this.people.get(e.personId);
      const last = e.sent.at(-1);
      e.received.push({
        messageId: reply?.messageId?.trim() || newId('msg'),
        from: reply?.from?.trim() || person.email,
        subject: reply?.subject?.trim() || (e.firstSubject ? `Re: ${e.firstSubject}` : '(no subject)'),
        body,
        receivedAt: reply?.receivedAt ?? new Date().toISOString(),
        inReplyTo: reply?.inReplyTo?.trim() || last?.messageId,
      });
    }
    const saved = seq.exitCriteria.onReply ? await this.finish(e, 'exited', 'replied') : await this.repo.saveEnrollment(e);
    this.events.emit(Events.EnrollmentReplied, { personId: e.personId, enrollmentId: e.id, sequenceId: e.sequenceId } satisfies CrmEvent);
    return saved;
  }

  /** Unsubscribe stops this enrollment AND blocks the address from every sequence. */
  async unsubscribe(id: string) {
    const e = await this.getEnrollment(id);
    const person = await this.people.get(e.personId);
    await this.repo.suppress(person.email);
    for (const other of await this.repo.findEnrollments({ personId: e.personId })) {
      await this.finish(other, 'unsubscribed', 'clicked unsubscribe');
    }
    return this.getEnrollment(id);
  }

  async pause(id: string) {
    const e = await this.getEnrollment(id);
    if (e.status !== 'active') throw new BadRequestException(`cannot pause a ${e.status} enrollment`);
    e.status = 'paused';
    return this.repo.saveEnrollment(e);
  }

  async resume(id: string) {
    const e = await this.getEnrollment(id);
    if (e.status !== 'paused' && e.status !== 'failed') throw new BadRequestException(`cannot resume a ${e.status} enrollment`);
    e.status = 'active';
    e.failures = 0;
    e.lastError = undefined;
    if (new Date(e.nextSendAt) < new Date()) e.nextSendAt = new Date().toISOString();
    return this.repo.saveEnrollment(e);
  }

  async remove(id: string) {
    return this.finish(await this.getEnrollment(id), 'exited', 'removed manually');
  }

  async stats(sequenceId: string) {
    const all = await this.repo.findEnrollments({ sequenceId });
    const byStatus: Record<string, number> = {};
    for (const e of all) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    // Both sides have to be the same population. Counting every replied enrollment
    // over only the contacted ones let the rate exceed 100% as soon as somebody was
    // marked as replied before their first email went out.
    const contacted = all.filter((e) => e.sent.length > 0);
    const replied = contacted.filter((e) => e.replied).length;
    return {
      total: all.length,
      byStatus,
      emailsSent: all.reduce((n, e) => n + e.sent.length, 0),
      replyRate: contacted.length ? Math.round((replied / contacted.length) * 100) + '%' : '0%',
    };
  }

  /** Exit people immediately when their record changes to match exit criteria (e.g. stage = meeting_booked). */
  @OnEvent(Events.PersonUpdated, { async: true })
  async onPersonUpdated(ev: CrmEvent) {
    try {
      const person = await this.people.get(ev.personId);
      for (const e of await this.repo.findEnrollments({ personId: ev.personId })) {
        if (e.status !== 'active' && e.status !== 'paused') continue;
        const seq = await this.repo.findSequence(e.sequenceId);
        if (seq?.exitCriteria.when.some((c) => evaluate(c, person))) {
          await this.finish(e, 'exited', 'matched exit criteria');
          this.logger.log(`${person.email} exited "${seq.name}" (matched exit criteria)`);
        }
      }
    } catch (err: any) {
      this.logger.error(`exit check failed: ${err?.message}`);
    }
  }
}