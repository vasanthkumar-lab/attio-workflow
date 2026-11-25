import { Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { MailSender, OutgoingEmail } from './mail-sender';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export class ResendMailSender implements MailSender {
  private readonly logger = new Logger('Resend');
  private readonly apiKey = process.env.RESEND_API_KEY!;

  async send(mail: OutgoingEmail): Promise<string> {
    const domain = mail.from.split('@')[1] ?? 'resend.dev';
    const id = `<${randomBytes(12).toString('hex')}@${domain}>`;

    const headers: Record<string, string> = { 'Message-ID': id };
    if (mail.inReplyTo) {
      headers['In-Reply-To'] = mail.inReplyTo;
      headers['References'] = mail.inReplyTo;
    }
    if (mail.unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${mail.unsubscribeUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? mail.from,
        reply_to: mail.from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        headers,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend returned ${res.status}: ${detail.slice(0, 300)}`);
    }

    this.logger.log(`sent to ${mail.to}: ${mail.subject}`);
    return id;
  }
}
