import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from './email/email.module';
import { EnrichmentModule } from './enrichment/enrichment.module';
import { MailboxesModule } from './mailboxes/mailboxes.module';
import { PeopleModule } from './people/people.module';
import { PrismaModule } from './prisma/prisma.module';
import { SeedService } from './seed.service';
import { SequencesModule } from './sequences/sequences.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    EmailModule,
    MailboxesModule,
    PeopleModule,
    EnrichmentModule,
    SequencesModule,
    WorkflowsModule,
  ],
  providers: [SeedService],
})
export class AppModule {}