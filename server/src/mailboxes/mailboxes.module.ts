import { Module } from '@nestjs/common';
import { GoogleOAuthService } from './google-oauth.service';
import { MailboxesController } from './mailboxes.controller';
import { MailboxesService } from './mailboxes.service';

@Module({
  controllers: [MailboxesController],
  providers: [GoogleOAuthService, MailboxesService],
  exports: [MailboxesService],
})
export class MailboxesModule {}
