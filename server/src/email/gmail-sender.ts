import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { OutgoingEmail, SendResult } from './mail-sender';

const SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

/**
 * A header value can never contain a newline. Subjects here are rendered from record
 * data - `{{firstName}}` and friends - so a person whose name holds a CRLF would
 * otherwise be able to append headers of their own, Bcc included. Folding the line
 * away is the whole fix, but it has to happen on every header we build.
 */
const headerSafe = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

/** RFC 2047: a non-ASCII subject has to be encoded or it arrives as mojibake. */
const encodeHeader = (value: string) => {
  const clean = headerSafe(value);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
};

/** Addresses go in bare, so anything that is not one is a bug worth stopping on. */
const address = (value: string) => {
  const clean = headerSafe(value);
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(clean)) {
    throw new Error(`not a plain email address: ${value}`);
  }
  return clean;
};

const base64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

interface GmailSendResponse {
  id?: string;
  threadId?: string;
  error?: { message?: string; status?: string };
}

/**
 * Sends as the salesperson, through the mailbox they connected.
 *
 * The point of this over a transactional API is deliverability and reply handling:
 * the message is really from their address, so it inherits their domain's reputation,
 * it lands in their own Sent folder, and a reply goes to their inbox rather than to a
 * no-reply nobody reads.
 */
@Injectable()
export class GmailMailSender {
  private readonly logger = new Logger('Gmail');

  async send(mail: OutgoingEmail, accessToken: string): Promise<SendResult> {
    const from = address(mail.from);
    const messageId = `<${randomBytes(12).toString('hex')}@${from.split('@')[1]}>`;
    const raw = this.mime(mail, from, messageId);

    const res = await fetch(SEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
      // threadId is Gmail's own handle on the conversation. We thread on it rather
      // than on In-Reply-To because Gmail is documented to rewrite a Message-ID it
      // does not like, and gmail.send alone cannot read the message back to find out
      // what it chose. The headers below still go out for the recipient's client.
      body: JSON.stringify({ raw, ...(mail.threadId ? { threadId: mail.threadId } : {}) }),
    });

    const body = (await res.json().catch(() => ({}))) as GmailSendResponse;

    if (!res.ok || !body.id) {
      const detail = body.error?.message ?? `HTTP ${res.status}`;
      // 401 survives a retry (the token refreshes); 403 and 429 are quota or scope,
      // where retrying just burns the allowance faster.
      this.logger.warn(`send as ${from} failed: ${detail}`);
      throw new Error(`Gmail refused the message (${res.status}): ${detail}`);
    }

    this.logger.log(`sent as ${from} to ${mail.to}: ${headerSafe(mail.subject)}`);
    return { messageId, threadId: body.threadId };
  }

  /** RFC 5322 message, base64url encoded, which is what the API takes. */
  private mime(mail: OutgoingEmail, from: string, messageId: string): string {
    const headers = [
      `From: ${from}`,
      `To: ${address(mail.to)}`,
      `Subject: ${encodeHeader(mail.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
    ];

    if (mail.inReplyTo) {
      const parent = headerSafe(mail.inReplyTo);
      headers.push(`In-Reply-To: ${parent}`, `References: ${parent}`);
    }
    if (mail.unsubscribeUrl) {
      headers.push(
        `List-Unsubscribe: <${headerSafe(mail.unsubscribeUrl)}>`,
        'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
      );
    }

    // base64 keeps the body safe from the 998-character line limit and from anything
    // non-ASCII in a signature, with no quoted-printable escaping to get wrong.
    const body = Buffer.from(mail.text, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
    return base64url(Buffer.from(`${headers.join('\r\n')}\r\n\r\n${body}`, 'utf8'));
  }
}
