import { GmailMailSender } from './gmail-sender';
import { OutgoingEmail } from './mail-sender';

/** Pulls the message back out of whatever we handed Gmail, so we can assert on it. */
const decode = (body: string) => {
  const raw = JSON.parse(body).raw as string;
  return Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
};

const headersOf = (mime: string) => mime.split('\r\n\r\n')[0];
const bodyOf = (mime: string) =>
  Buffer.from(mime.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n/g, ''), 'base64').toString('utf8');

describe('GmailMailSender', () => {
  const base: OutgoingEmail = {
    from: 'rep@hyring.com',
    to: 'lead@acme.com',
    subject: 'Quick question',
    text: 'Hi there',
  };

  let sender: GmailMailSender;
  let sent: { url: string; init: any }[];

  const respond = (status: number, payload: unknown) => {
    globalThis.fetch = (async (url: string, init: any) => {
      sent.push({ url, init });
      return { ok: status < 400, status, json: async () => payload } as any;
    }) as any;
  };

  beforeEach(() => {
    sender = new GmailMailSender();
    sent = [];
    respond(200, { id: 'abc', threadId: 'thread-1' });
  });

  it('sends the message and reports the thread Gmail put it in', async () => {
    const result = await sender.send(base, 'token-123');

    expect(sent[0].init.headers.Authorization).toBe('Bearer token-123');
    expect(result.threadId).toBe('thread-1');
    // The Message-ID we minted, not Gmail's internal id, because that is what the
    // follow-up quotes in In-Reply-To.
    expect(result.messageId).toMatch(/^<[0-9a-f]{24}@hyring\.com>$/);
    expect(result.messageId).not.toContain('abc');
  });

  it('builds a message the recipient can actually read', async () => {
    await sender.send(base, 't');
    const mime = decode(sent[0].init.body);

    expect(headersOf(mime)).toContain('From: rep@hyring.com');
    expect(headersOf(mime)).toContain('To: lead@acme.com');
    expect(headersOf(mime)).toContain('Subject: Quick question');
    expect(bodyOf(mime)).toBe('Hi there');
  });

  it('cannot be talked into adding headers through the subject', async () => {
    // A record's firstName lands in the subject, so this is reachable by anyone who
    // can create a person: without folding, Bcc below would be a real header.
    await sender.send({ ...base, subject: 'Hi\r\nBcc: everyone@acme.com' }, 't');
    const headers = headersOf(decode(sent[0].init.body));

    expect(headers).not.toMatch(/^Bcc:/m);
    expect(headers).toContain('Subject: Hi Bcc: everyone@acme.com');
  });

  it('encodes a non-ASCII subject rather than mangling it', async () => {
    await sender.send({ ...base, subject: 'Café hiring' }, 't');
    const headers = headersOf(decode(sent[0].init.body));

    expect(headers).toContain(`Subject: =?UTF-8?B?${Buffer.from('Café hiring', 'utf8').toString('base64')}?=`);
  });

  it('keeps a follow-up in the same conversation', async () => {
    await sender.send({ ...base, inReplyTo: '<first@hyring.com>', threadId: 'thread-1' }, 't');

    expect(JSON.parse(sent[0].init.body).threadId).toBe('thread-1');
    const headers = headersOf(decode(sent[0].init.body));
    expect(headers).toContain('In-Reply-To: <first@hyring.com>');
    expect(headers).toContain('References: <first@hyring.com>');
  });

  it('omits threadId on a first email', async () => {
    await sender.send(base, 't');
    expect(JSON.parse(sent[0].init.body)).not.toHaveProperty('threadId');
  });

  it('survives a long body and a UTF-8 signature', async () => {
    const text = `${'x'.repeat(5000)}\n\n— Café`;
    await sender.send({ ...base, text }, 't');
    // The 998-character line limit is why the body is base64, so this has to round-trip.
    expect(bodyOf(decode(sent[0].init.body))).toBe(text);
  });

  it('reports what Gmail said when it refuses', async () => {
    respond(403, { error: { message: 'Daily sending quota exceeded' } });
    await expect(sender.send(base, 't')).rejects.toThrow(/403.*Daily sending quota exceeded/);
  });

  it('refuses a From that is not a plain address', async () => {
    await expect(sender.send({ ...base, from: 'Rep <rep@hyring.com>' }, 't')).rejects.toThrow(/plain email address/);
    expect(sent).toHaveLength(0);
  });
});
