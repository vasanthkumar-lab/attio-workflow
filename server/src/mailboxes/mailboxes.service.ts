import {
  BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { MailboxStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleOAuthService } from './google-oauth.service';
import { decryptToken, encryptToken, encryptionConfigured } from './token-crypto';

/** How long a half-finished connect attempt stays valid. */
const STATE_TTL_MS = 10 * 60_000;
/** Refresh this far before expiry rather than waiting to be rejected. */
const REFRESH_MARGIN_MS = 60_000;

/** What the UI is allowed to see. Never includes a token. */
export interface MailboxSummary {
  id: string;
  email: string;
  provider: string;
  status: MailboxStatus;
  statusDetail: string | null;
  scopes: string[];
  dailyLimit: number;
  sentToday: number;
  connectedAt: string;
}

@Injectable()
export class MailboxesService {
  private readonly logger = new Logger(MailboxesService.name);

  /**
   * Outstanding connect attempts, keyed by the `state` we sent to Google. Checking it
   * on the way back is what stops an attacker handing your salesperson a crafted
   * callback URL that attaches *their* mailbox to your CRM. In memory is fine: the
   * value is worthless after ten minutes, and a restart mid-flow just means retrying.
   */
  private readonly pending = new Map<string, { createdAt: number; returnTo?: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleOAuthService,
  ) {}

  // ------------------------------------------------------------------ connect

  /** Steps 1-2: mint a state value and hand back the Google consent URL. */
  startGoogle(returnTo?: string): string {
    if (!this.google.configured) {
      throw new ServiceUnavailableException(
        'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set. Create an OAuth client at ' +
          'https://console.cloud.google.com/apis/credentials and add them to server/.env',
      );
    }
    if (!encryptionConfigured()) {
      throw new ServiceUnavailableException(
        'TOKEN_ENCRYPTION_KEY is not set, so tokens could not be stored safely. Generate one with: ' +
          'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    // Touch the getter so a missing database fails now, with a useful message,
    // rather than after the salesperson has already granted consent.
    void this.prisma.db;

    this.sweep();
    const state = randomBytes(24).toString('base64url');
    this.pending.set(state, { createdAt: Date.now(), returnTo });
    return this.google.consentUrl(state);
  }

  /** Steps 6-8: verify state, exchange the code, store the tokens encrypted. */
  async completeGoogle(code: string, state: string): Promise<{ email: string; returnTo?: string }> {
    const attempt = this.pending.get(state);
    this.pending.delete(state);
    if (!attempt || Date.now() - attempt.createdAt > STATE_TTL_MS) {
      throw new BadRequestException('That sign-in link has expired or was not started here. Try again.');
    }

    const tokens = await this.google.exchangeCode(code);
    if (!tokens.refreshToken) {
      throw new BadRequestException(
        'Google did not return a refresh token. Remove this app at ' +
          'https://myaccount.google.com/permissions and connect again.',
      );
    }

    const email = await this.google.mailboxEmail(tokens.accessToken);

    await this.prisma.db.mailboxConnection.upsert({
      where: { workspaceId_email: { workspaceId: 'default', email } },
      create: {
        email,
        provider: 'GOOGLE',
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: encryptToken(tokens.refreshToken),
        accessExpires: tokens.expiresAt,
        scopes: tokens.scopes,
        status: 'ACTIVE',
      },
      update: {
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: encryptToken(tokens.refreshToken),
        accessExpires: tokens.expiresAt,
        scopes: tokens.scopes,
        status: 'ACTIVE',
        statusDetail: null,
      },
    });

    this.logger.log(`connected mailbox ${email}`);
    return { email, returnTo: attempt.returnTo };
  }

  // -------------------------------------------------------------------- reads

  async list(): Promise<MailboxSummary[]> {
    const rows = await this.prisma.db.mailboxConnection.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      provider: row.provider,
      status: row.status,
      statusDetail: row.statusDetail,
      scopes: row.scopes,
      dailyLimit: row.dailyLimit,
      sentToday: this.todaysCount(row.sentToday, row.sentTodayOn),
      connectedAt: row.createdAt.toISOString(),
    }));
  }

  async disconnect(id: string): Promise<{ id: string; disconnected: true }> {
    const row = await this.prisma.db.mailboxConnection.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`mailbox ${id} not found`);
    await this.prisma.db.mailboxConnection.delete({ where: { id } });
    this.logger.log(`disconnected mailbox ${row.email}`);
    return { id, disconnected: true };
  }

  /**
   * A usable access token for this address, refreshing first when it is close to
   * expiry. Returns undefined when nothing is connected, so a caller can fall back
   * to the configured transactional sender.
   */
  async accessTokenFor(email: string): Promise<string | undefined> {
    if (!this.prisma.enabled) return undefined;

    const row = await this.prisma.db.mailboxConnection.findUnique({
      where: { workspaceId_email: { workspaceId: 'default', email: email.toLowerCase() } },
    });
    if (!row || row.status !== 'ACTIVE') return undefined;

    if (row.accessExpires.getTime() - Date.now() > REFRESH_MARGIN_MS) {
      return decryptToken(row.accessToken);
    }

    try {
      const next = await this.google.refresh(decryptToken(row.refreshToken));
      await this.prisma.db.mailboxConnection.update({
        where: { id: row.id },
        data: {
          accessToken: encryptToken(next.accessToken),
          accessExpires: next.expiresAt,
          // Google usually omits it on refresh; keep the one we have when it does.
          ...(next.refreshToken ? { refreshToken: encryptToken(next.refreshToken) } : {}),
        },
      });
      return next.accessToken;
    } catch (err) {
      // invalid_grant means revoked or password changed: a human has to reconnect,
      // so say so once and stop trying rather than burning retries on every send.
      const detail = (err as Error)?.message ?? 'refresh failed';
      await this.prisma.db.mailboxConnection.update({
        where: { id: row.id },
        data: { status: 'REAUTH_REQUIRED', statusDetail: detail },
      });
      this.logger.warn(`mailbox ${row.email} needs reconnecting: ${detail}`);
      return undefined;
    }
  }

  /**
   * Claims one send against today's allowance, returning false when the mailbox is
   * already at its limit.
   *
   * Gmail cuts a free account off at around 500 messages a day and a Workspace one at
   * 2000, and it does not fail politely - it starts bouncing, and a mailbox that trips
   * it can end up restricted for a day. Counting here means we stop first.
   *
   * In a transaction because the read and the write have to agree; without one, two
   * ticks overlapping would both see 499 and both send.
   */
  async reserveSend(email: string): Promise<boolean> {
    if (!this.prisma.enabled) return true;

    return this.prisma.db.$transaction(async (tx) => {
      const row = await tx.mailboxConnection.findUnique({
        where: { workspaceId_email: { workspaceId: 'default', email: email.toLowerCase() } },
      });
      // Nothing connected: this send is going out over the transactional sender, whose
      // quota is not ours to track.
      if (!row) return true;

      const sentToday = this.todaysCount(row.sentToday, row.sentTodayOn);
      if (sentToday >= row.dailyLimit) return false;

      await tx.mailboxConnection.update({
        where: { id: row.id },
        data: { sentToday: sentToday + 1, sentTodayOn: new Date() },
      });
      return true;
    });
  }

  // ------------------------------------------------------------------ helpers

  private todaysCount(sentToday: number, on: Date | null): number {
    if (!on) return 0;
    const sameDay = on.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
    return sameDay ? sentToday : 0;
  }

  private sweep() {
    const cutoff = Date.now() - STATE_TTL_MS;
    for (const [state, attempt] of this.pending) {
      if (attempt.createdAt < cutoff) this.pending.delete(state);
    }
  }
}
