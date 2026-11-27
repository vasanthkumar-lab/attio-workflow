import type { MailboxesService } from '../mailboxes/mailboxes.service';
import type { GmailMailSender } from './gmail-sender';
import { MailSender, OutgoingEmail, SendResult } from './mail-sender';
import { ResolvingMailSender } from './mail-sender.resolver';

const mail: OutgoingEmail = {
  from: 'rep@hyring.com',
  to: 'lead@acme.com',
  subject: 'Hello',
  text: 'Hi',
};

describe('ResolvingMailSender', () => {
  let fallbackCalls: OutgoingEmail[];
  let gmailCalls: { mail: OutgoingEmail; token: string }[];
  let fallback: MailSender;
  let gmail: GmailMailSender;

  beforeEach(() => {
    fallbackCalls = [];
    gmailCalls = [];
    fallback = {
      async send(m): Promise<SendResult> {
        fallbackCalls.push(m);
        return { messageId: '<fallback@example.com>' };
      },
    };
    gmail = {
      async send(m: OutgoingEmail, token: string): Promise<SendResult> {
        gmailCalls.push({ mail: m, token });
        return { messageId: '<gmail@hyring.com>', threadId: 'thread-1' };
      },
    } as GmailMailSender;
  });

  const build = (mailboxes: Partial<MailboxesService>) =>
    new ResolvingMailSender(mailboxes as MailboxesService, gmail, fallback);

  it('uses the configured sender when nothing is connected', async () => {
    const resolver = build({ accessTokenFor: async () => undefined, reserveSend: async () => true });

    expect(await resolver.send(mail)).toEqual({ messageId: '<fallback@example.com>' });
    expect(fallbackCalls).toHaveLength(1);
    expect(gmailCalls).toHaveLength(0);
  });

  it('sends through the connected mailbox when the From address owns one', async () => {
    const resolver = build({ accessTokenFor: async () => 'tok', reserveSend: async () => true });
    const result = await resolver.send(mail);

    expect(gmailCalls).toEqual([{ mail, token: 'tok' }]);
    expect(fallbackCalls).toHaveLength(0);
    // The thread handle has to survive, or the follow-up starts a new conversation.
    expect(result.threadId).toBe('thread-1');
  });

  it('looks the mailbox up by the From address, not a default', async () => {
    const asked: string[] = [];
    const resolver = build({
      accessTokenFor: async (email: string) => { asked.push(email); return undefined; },
      reserveSend: async () => true,
    });

    await resolver.send({ ...mail, from: 'someone.else@hyring.com' });
    expect(asked).toEqual(['someone.else@hyring.com']);
  });

  it('stops at the daily limit instead of sending as somebody else', async () => {
    const resolver = build({ accessTokenFor: async () => 'tok', reserveSend: async () => false });

    await expect(resolver.send(mail)).rejects.toThrow(/daily sending limit/);
    expect(gmailCalls).toHaveLength(0);
    expect(fallbackCalls).toHaveLength(0);
  });

  it('does not spend the allowance on a message the fallback sends', async () => {
    let reserved = 0;
    const resolver = build({
      accessTokenFor: async () => undefined,
      reserveSend: async () => { reserved += 1; return true; },
    });

    await resolver.send(mail);
    expect(reserved).toBe(0);
  });

  it('keeps sending when the mailbox lookup itself fails', async () => {
    // Postgres down mid-run. The sequence must not stall because of it.
    const resolver = build({
      accessTokenFor: async () => { throw new Error('connection refused'); },
      reserveSend: async () => true,
    });

    expect(await resolver.send(mail)).toEqual({ messageId: '<fallback@example.com>' });
    expect(fallbackCalls).toHaveLength(1);
  });

  it('lets a Gmail failure surface rather than quietly rerouting it', async () => {
    gmail = { async send() { throw new Error('Gmail refused the message (429): rate limit'); } } as unknown as GmailMailSender;
    const resolver = build({ accessTokenFor: async () => 'tok', reserveSend: async () => true });

    await expect(resolver.send(mail)).rejects.toThrow(/429/);
    expect(fallbackCalls).toHaveLength(0);
  });
});
