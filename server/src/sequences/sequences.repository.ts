import { Injectable } from '@nestjs/common';
import {
  DeliverySettings, EmailSettings, Enrollment, ExitCriteria, Sequence, SentEmail, SequenceStep,
} from './sequence.types';

/**
 * In-memory storage. A restart loses every scheduled follow-up and the suppression
 * list, so this is fine for a demo but not for sending real email.
 */
@Injectable()
export class SequencesRepository {
  private readonly sequences = new Map<string, Sequence>();
  private readonly enrollments = new Map<string, Enrollment>();
  private readonly suppressed = new Set<string>();

  async saveSequence(s: Sequence) {
    this.sequences.set(s.id, structuredClone(s));
    return structuredClone(s);
  }
  async findSequence(id: string) {
    const s = this.sequences.get(id);
    return s ? structuredClone(s) : undefined;
  }
  async listSequences() {
    return [...this.sequences.values()].map((s) => structuredClone(s));
  }
  async deleteSequence(id: string) {
    return this.sequences.delete(id);
  }

  async saveEnrollment(e: Enrollment) {
    e.updatedAt = new Date().toISOString();
    this.enrollments.set(e.id, structuredClone(e));
    return structuredClone(e);
  }
  async findEnrollment(id: string) {
    const e = this.enrollments.get(id);
    return e ? structuredClone(e) : undefined;
  }

  async findEnrollments(filter: Partial<Pick<Enrollment, 'sequenceId' | 'personId' | 'status'>>) {
    return [...this.enrollments.values()]
      .filter((e) =>
        Object.entries(filter).every(([k, v]) => v === undefined || (e as any)[k] === v),
      )
      .map((e) => structuredClone(e));
  }

  async findDue(now: Date, limit = 100) {
    const due: Enrollment[] = [];
    for (const e of this.enrollments.values()) {
      if (e.status === 'active' && new Date(e.nextSendAt) <= now) due.push(structuredClone(e));
      if (due.length >= limit) break;
    }
    return due;
  }

  async suppress(email: string) {
    this.suppressed.add(email.toLowerCase());
  }
  async isSuppressed(email: string) {
    return this.suppressed.has(email.toLowerCase());
  }
}
