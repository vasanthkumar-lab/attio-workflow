import {
  Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Postgres is optional. Only the mailbox connections live there, so when DATABASE_URL
 * is unset - or the database simply is not up - the app still boots and every other
 * feature works off its in-memory stores. Asking for `db` in that state is a 503 with
 * a message that says what to do, rather than a crash at startup.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private client?: PrismaClient;
  private reason = 'DATABASE_URL is not set';

  get enabled(): boolean {
    return Boolean(this.client);
  }

  get db(): PrismaClient {
    if (!this.client) {
      throw new ServiceUnavailableException(
        `Mailbox connections need Postgres, which is not available: ${this.reason}. ` +
          `Start it with "docker compose up -d db", set DATABASE_URL, then run "npm run db:migrate".`,
      );
    }
    return this.client;
  }

  async onModuleInit() {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      this.logger.warn('DATABASE_URL not set - mailbox connections are unavailable');
      return;
    }

    const client = new PrismaClient({ adapter: new PrismaPg(url) });
    try {
      await client.$connect();
      this.client = client;
      this.logger.log('connected to Postgres');
    } catch (err) {
      // Deliberately not fatal: a demo with no database should still start.
      this.reason = (err as Error)?.message ?? 'could not connect';
      this.logger.warn(`could not reach Postgres, mailbox connections disabled: ${this.reason}`);
      await client.$disconnect().catch(() => undefined);
    }
  }

  async onModuleDestroy() {
    await this.client?.$disconnect().catch(() => undefined);
  }
}
