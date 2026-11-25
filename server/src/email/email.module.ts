import { Global, Logger, Module } from '@nestjs/common';
import { ConsoleMailSender, MAIL_SENDER, SmtpMailSender } from './mail-sender';
import { ResendMailSender } from './resend-sender';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_SENDER,
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
  ],
  exports: [MAIL_SENDER],
})
export class EmailModule {}
