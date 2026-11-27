import { SequencesService } from './sequences.service';
import type { Enrollment, Sequence } from './sequence.types';

/**
 * markReplied is the one entry point a reply takes, whether it comes from an inbox
 * sync or from somebody pasting it into the UI, so the recording is worth pinning down.
 */

const sequence = (over: Partial<Sequence> = {}): Sequence =>
  ({
    id: 'seq_1',
    name: 'Outreach',
    enabled: true,
    steps: [{ waitBusinessDays: 0, subject: 'Hi', body: 'Hello' }],
    delivery: { startHour: 9, endHour: 17, timezone: 'UTC', days: [1, 2, 3, 4, 5] },
    email: { threadEmails: true, includeSignature: false, unsubscribeText: 'Unsubscribe' },
    exitCriteria: { onReply: true, when: [] },
    defaultSender: 'rep@hyring.com',
    createdAt: '', updatedAt: '',
    ...over,
  }) as Sequence;

const enrollment = (over: Partial<Enrollment> = {}): Enrollment =>
  ({
    id: 'enr_1',
    sequenceId: 'seq_1',
    personId: 'per_1',
    sender: 'rep@hyring.com',
    status: 'active',
    currentStep: 1,
    nextSendAt: new Date().toISOString(),
    replied: false,
    firstSubject: 'Hiring at Acme?',
    sent: [{ step: 0, subject: 'Hiring at Acme?', messageId: '<a@hyring.com>', sentAt: '2026-01-01T10:00:00Z', body: 'Hello' }],
    received: [],
    failures: 0,
    enrolledBy: 'test',
    enrolledAt: '', updatedAt: '',
    ...over,
  }) as Enrollment;

function build(e: Enrollment, seq = sequence()) {
  const store = new Map([[e.id, e]]);
  const repo = {
    findEnrollment: async (id: string) => store.get(id),
    findSequence: async () => seq,
    saveEnrollment: async (x: Enrollment) => { store.set(x.id, x); return x; },
    findEnrollments: async () => [...store.values()],
  };
  const people = { get: async () => ({ id: 'per_1', email: 'asha@acme.test', name: 'Asha Rao' }) };
  const events = { emit: () => true };
  const service = new SequencesService(repo as any, people as any, events as any);
  return { service, store };
}

describe('markReplied', () => {
  it('stores the reply so the thread has something to show', async () => {
    const { service } = build(enrollment());
    const body = 'Thanks!\n\nCan we talk Thursday?';

    const e = await service.markReplied('enr_1', { body });

    expect(e.received).toHaveLength(1);
    // Verbatim: the thread renders this with whitespace preserved.
    expect(e.received[0].body).toBe(body);
    expect(e.received[0].from).toBe('asha@acme.test');
    expect(e.received[0].subject).toBe('Re: Hiring at Acme?');
    // Hangs off the last thing we sent, which is what makes it a conversation.
    expect(e.received[0].inReplyTo).toBe('<a@hyring.com>');
  });

  it('prefers what the inbox sync tells us over any default', async () => {
    const { service } = build(enrollment());

    const e = await service.markReplied('enr_1', {
      body: 'Sure.',
      from: 'assistant@acme.test',
      subject: 'Re: your note',
      messageId: '<real@acme.test>',
      inReplyTo: '<a@hyring.com>',
      receivedAt: '2026-01-02T09:00:00Z',
    });

    // A reply often comes from an alias or a colleague, not the address we mailed.
    expect(e.received[0].from).toBe('assistant@acme.test');
    expect(e.received[0].subject).toBe('Re: your note');
    expect(e.received[0].messageId).toBe('<real@acme.test>');
    expect(e.received[0].receivedAt).toBe('2026-01-02T09:00:00Z');
  });

  it('still just flags the enrollment when no message is given', async () => {
    const { service } = build(enrollment());

    const e = await service.markReplied('enr_1');

    expect(e.replied).toBe(true);
    expect(e.received).toHaveLength(0);
  });

  it('ignores an empty or blank body rather than logging a silent message', async () => {
    const { service } = build(enrollment());

    const e = await service.markReplied('enr_1', { body: '   \n  ' });

    expect(e.replied).toBe(true);
    expect(e.received).toHaveLength(0);
  });

  it('stops the sequence when the sequence exits on reply', async () => {
    const { service } = build(enrollment());

    const e = await service.markReplied('enr_1', { body: 'No thanks' });

    expect(e.status).toBe('exited');
    expect(e.exitReason).toBe('replied');
  });

  it('keeps sending when the sequence is set not to exit on reply', async () => {
    const seq = sequence({ exitCriteria: { onReply: false, when: [] } });
    const { service } = build(enrollment(), seq);

    const e = await service.markReplied('enr_1', { body: 'Interesting' });

    expect(e.replied).toBe(true);
    expect(e.status).toBe('active');
  });

  it('copes with an enrollment created before replies could be stored', async () => {
    const old = enrollment();
    delete (old as Partial<Enrollment>).received;
    const { service } = build(old);

    const e = await service.markReplied('enr_1', { body: 'Hello back' });

    expect(e.received).toHaveLength(1);
  });

  it('appends a second reply rather than replacing the first', async () => {
    const { service } = build(enrollment());

    await service.markReplied('enr_1', { body: 'One' });
    const e = await service.markReplied('enr_1', { body: 'Two' });

    expect(e.received.map((r) => r.body)).toEqual(['One', 'Two']);
  });
});

describe('replyRate', () => {
  it('never exceeds 100% when someone is marked replied before their first email', async () => {
    const contacted = enrollment({ id: 'enr_1', replied: true });
    const neverSent = enrollment({ id: 'enr_2', replied: true, sent: [] });
    const { service, store } = build(contacted);
    store.set('enr_2', neverSent);

    const stats = await service.stats('seq_1');

    // Two replied, one contacted: counting across different populations gave 200%.
    expect(stats.replyRate).toBe('100%');
  });

  it('reports 0% with nothing sent', async () => {
    const { service } = build(enrollment({ sent: [], replied: false }));
    expect((await service.stats('seq_1')).replyRate).toBe('0%');
  });
});
