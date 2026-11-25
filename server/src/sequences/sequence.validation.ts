import { BadRequestException } from '@nestjs/common';
import { validateCondition } from '../common/conditions';

/** Validates a sequence definition coming from the API. Throws 400 with a clear message. */
export function validateSequenceInput(input: any): void {
  const fail = (msg: string) => { throw new BadRequestException(msg); };

  if (!input || typeof input !== 'object') fail('body must be a JSON object');
  if (typeof input.name !== 'string' || !input.name.trim()) fail('name is required');
  if (!Array.isArray(input.steps) || input.steps.length === 0) fail('steps must contain at least one step');
  input.steps.forEach((s: any, i: number) => {
    if (typeof s?.body !== 'string' || !s.body.trim()) fail(`steps[${i}].body is required`);
    if (!Number.isInteger(s.waitBusinessDays ?? 0) || (s.waitBusinessDays ?? 0) < 0) fail(`steps[${i}].waitBusinessDays must be a whole number >= 0`);
  });
  if (typeof input.steps[0].subject !== 'string' || !input.steps[0].subject.trim()) fail('steps[0].subject is required');

  const d = input.delivery ?? {};
  if (d.timezone !== undefined) {
    try { new Intl.DateTimeFormat('en', { timeZone: d.timezone }); } catch { fail(`delivery.timezone "${d.timezone}" is not a valid IANA time zone`); }
  }
  const start = d.startHour ?? 9, end = d.endHour ?? 17;
  if (!(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= 24 && start < end)) {
    fail('delivery.startHour and delivery.endHour must be whole hours with startHour < endHour');
  }
  if (typeof input.defaultSender !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(input.defaultSender)) fail('defaultSender must be an email address');

  (input.exitCriteria?.when ?? []).forEach((c: any, i: number) => {
    const err = validateCondition(c, `exitCriteria.when[${i}]`);
    if (err) fail(err);
  });
}