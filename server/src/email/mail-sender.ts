import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as nodemailer from 'nodemailer';

export interface OutgoingEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string; // Message-ID of the first email -> follow-ups appear in the same thread
  unsubscribeUrl?: string;
}

export interface MailSender {
  /** Sends the email and returns its Message-ID. */
  send(mail: OutgoingEmail): Promise<string>;
}

export const MAIL_SENDER = Symbol('MAIL_SENDER');

const messageId = (from: string) => `<${randomBytes(12).toString('hex')}@${from.split('@')[1] ?? 'localhost'}>`;

/** Development sender: prints emails to the console. */
@Injectable()
export class ConsoleMailSender implements MailSender {
  private readonly logger = new Logger('Email');

  async send(mail: OutgoingEmail) {
    const id = messageId(mail.from);
    const thread = mail.inReplyTo ? ` (reply in thread ${mail.inReplyTo})` : '';
    this.logger.log(`${mail.from} -> ${mail.to}${thread}\n  Subject: ${mail.subject}\n  ${mail.text.replace(/\n/g, '\n  ')}`);
    return id;
  }
}

/** Real sender over SMTP (Google Workspace, Amazon SES, SendGrid, Postmark, ...). */
export class SmtpMailSender implements MailSender {
  private readonly transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  async send(mail: OutgoingEmail) {
    const id = messageId(mail.from);
    await this.transport.sendMail({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      messageId: id,
      inReplyTo: mail.inReplyTo,
      references: mail.inReplyTo ? [mail.inReplyTo] : undefined,
      list: mail.unsubscribeUrl ? { unsubscribe: { url: mail.unsubscribeUrl, comment: 'Unsubscribe' } } : undefined,
      headers: mail.unsubscribeUrl ? { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined,
    });
    return id;
  }
}