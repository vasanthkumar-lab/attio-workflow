import { Global, Logger, Module } from '@nestjs/common';
import { MailboxesModule } from '../mailboxes/mailboxes.module';
import { GmailMailSender } from './gmail-sender';
import { ConsoleMailSender, MAIL_SENDER, SmtpMailSender } from './mail-sender';
import { FALLBACK_MAIL_SENDER, ResolvingMailSender } from './mail-sender.resolver';
import { ResendMailSender } from './resend-sender';

@Global()
@Module({
  imports: [MailboxesModule],
  providers: [
    GmailMailSender,
    {
      // What sends when the From address has no mailbox connected. This used to be
      // MAIL_SENDER itself; the resolver in front of it is the only thing that moved.
      provide: FALLBACK_MAIL_SENDER,
      useFactory: () => {
        if (process.env.RESEND_API_KEY) {
          Logger.log('sending email through Resend', 'Email');
          return new ResendMailSender();
        }
        if (process.env.SMTP_HOST) {
          Logger.log(`sending email through SMTP (${process.env.SMTP_HOST})`, 'Email');
          return new SmtpMailSender();
        }
        Logger.log('no RESEND_API_KEY or SMTP_HOST set - printing emails to the console', 'Email');
        return new ConsoleMailSender();
      },
    },
    { provide: MAIL_SENDER, useClass: ResolvingMailSender },
  ],
  exports: [MAIL_SENDER],
})
export class EmailModule {}
