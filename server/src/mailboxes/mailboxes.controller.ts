import {
  Controller, Delete, Get, Param, Query, Redirect,
} from '@nestjs/common';
import { MailboxesService } from './mailboxes.service';

const appUrl = () => process.env.APP_URL?.trim() || 'http://localhost:3001';

/** Only same-origin paths, so ?returnTo= cannot be used as an open redirect. */
const safeReturn = (returnTo?: string) =>
  returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/settings/mailboxes';

@Controller('mailboxes')
export class MailboxesController {
  constructor(private readonly mailboxes: MailboxesService) {}

  @Get()
  list() {
    return this.mailboxes.list();
  }

  /** Step 1: the browser hits this and is bounced to Google's consent screen. */
  @Get('google/connect')
  @Redirect()
  connectGoogle(@Query('returnTo') returnTo?: string) {
    return { url: this.mailboxes.startGoogle(returnTo), statusCode: 302 };
  }

  /**
   * Step 6: Google sends the browser back here. Both outcomes end on a page in the
   * UI rather than as JSON, because a person is looking at this, not a script.
   */
  @Get('google/callback')
  @Redirect()
  async callbackGoogle(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const back = (params: Record<string, string>, returnTo?: string) => ({
      url: `${appUrl()}${safeReturn(returnTo)}?${new URLSearchParams(params).toString()}`,
      statusCode: 302,
    });

    // The salesperson pressed Cancel on the consent screen.
    if (error) return back({ mailbox: 'error', reason: error });
    if (!code || !state) return back({ mailbox: 'error', reason: 'missing_code' });

    try {
      const { email, returnTo } = await this.mailboxes.completeGoogle(code, state);
      return back({ mailbox: 'connected', email }, returnTo);
    } catch (err) {
      return back({ mailbox: 'error', reason: (err as Error)?.message ?? 'failed' });
    }
  }

  @Delete(':id')
  disconnect(@Param('id') id: string) {
    return this.mailboxes.disconnect(id);
  }
}
