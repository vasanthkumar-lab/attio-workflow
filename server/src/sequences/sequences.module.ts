import { Module } from '@nestjs/common';
import { PeopleModule } from '../people/people.module';
import { EnrollmentsController, SequencesController, UnsubscribeController } from './sequences.controller';
import { SequenceRunnerService } from './sequence-runner.service';
import { SequencesRepository } from './sequences.repository';
import { SequencesService } from './sequences.service';

@Module({
  imports: [PeopleModule],
  controllers: [SequencesController, EnrollmentsController, UnsubscribeController],
  providers: [SequencesRepository, SequencesService, SequenceRunnerService],
  exports: [SequencesService],
})
export class SequencesModule {}