import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from './email/email.module';
import { EnrichmentModule } from './enrichment/enrichment.module';
import { PeopleModule } from './people/people.module';
import { SeedService } from './seed.service';
import { SequencesModule } from './sequences/sequences.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    EmailModule,
    PeopleModule,
    EnrichmentModule,
    SequencesModule,
    WorkflowsModule,
  ],
  providers: [SeedService],
})
export class AppModule {}