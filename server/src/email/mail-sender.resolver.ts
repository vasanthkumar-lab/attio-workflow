import { Inject, Injectable, Logger } from '@nestjs/common';
import { MailboxesService } from '../mailboxes/mailboxes.service';
import { GmailMailSender } from './gmail-sender';
import { MailSender, OutgoingEmail, SendResult } from './mail-sender';

/** The configured transactional sender, used when the From address owns no mailbox. */
export const FALLBACK_MAIL_SENDER = Symbol('FALLBACK_MAIL_SENDER');

/**
 * Chooses a transport per message, on the From address.
 *
 * A sequence's sender is just a string on the enrollment, and until now it was decor:
 * every message went out over whatever single transport was configured. If that
 * address belongs to a connected mailbox the message now goes through it, as them.
 * Otherwise nothing changes and the configured sender handles it, so an app with no
 * mailboxes connected behaves exactly as it did before.
 */
@Injectable()
export class ResolvingMailSender implements MailSender {
  private readonly logger = new Logger('Email');

  constructor(
    private readonly mailboxes: MailboxesService,
    private readonly gmail: GmailMailSender,
    @Inject(FALLBACK_MAIL_SENDER) private readonly fallback: MailSender,
  ) {}

  async send(mail: OutgoingEmail): Promise<SendResult> {
    const token = await this.tokenFor(mail.from);
    if (!token) return this.fallback.send(mail);

    if (!(await this.mailboxes.reserveSend(mail.from))) {
      // Deliberately not falling through to the transactional sender: the point of
      // connecting a mailbox is that the message comes from that person, and quietly
      // sending half a sequence from somewhere else is worse than waiting.
      throw new Error(
        `${mail.from} has reached its daily sending limit. It resets at midnight UTC; ` +
          `raise dailyLimit on the mailbox if the cap is wrong.`,
      );
    }

    return this.gmail.send(mail, token);
  }

  /**
   * A mailbox lookup must never be what stops a sequence. If Postgres is down or the
   * connection needs reauthorising we say so and let the configured sender carry the
   * message, which is the behaviour the app had before mailboxes existed.
   */
  private async tokenFor(from: string): Promise<string | undefined> {
    try {
      return await this.mailboxes.accessTokenFor(from);
    } catch (err) {
      this.logger.warn(`could not read the mailbox for ${from}, using the configured sender: ${(err as Error)?.message}`);
      return undefined;
    }
  }
}
