import { evaluate, validateCondition } from './conditions';
import { missingFields, renderTemplate } from './template';

describe('conditions', () => {
  const p = { score: 72, title: 'Head of Talent', stage: 'lead', company: '' };

  it('compares numbers and text', () => {
    expect(evaluate({ field: 'score', op: 'gte', value: 50 }, p)).toBe(true);
    expect(evaluate({ field: 'title', op: 'contains', value: 'talent' }, p)).toBe(true);
    expect(evaluate({ field: 'stage', op: 'in', value: ['customer', 'meeting_booked'] }, p)).toBe(false);
    expect(evaluate({ field: 'company', op: 'isEmpty' }, p)).toBe(true);
  });

  it('supports any / all groups', () => {
    expect(evaluate({ any: [{ field: 'score', op: 'lt', value: 10 }, { field: 'stage', op: 'eq', value: 'lead' }] }, p)).toBe(true);
    expect(evaluate({ all: [{ field: 'score', op: 'lt', value: 10 }, { field: 'stage', op: 'eq', value: 'lead' }] }, p)).toBe(false);
  });

  it('rejects bad conditions', () => {
    expect(validateCondition({ field: 'score', op: 'bigger' })).toMatch(/op must be/);
    expect(validateCondition({ any: [] })).toMatch(/non-empty/);
  });
});

describe('templates', () => {
  it('fills fields and fallbacks', () => {
    expect(renderTemplate('Hi {{firstName}}, hiring at {{company | your team}}?', { firstName: 'Priya', company: '' }))
      .toBe('Hi Priya, hiring at your team?');
  });

  it('reports missing fields that have no fallback', () => {
    expect(missingFields('Hi {{firstName}} at {{company | you}}', {})).toEqual(['firstName']);
  });
});