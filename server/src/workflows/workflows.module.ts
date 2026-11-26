import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { PeopleModule } from '../people/people.module';
import { SequencesModule } from '../sequences/sequences.module';
import { STEP_HANDLERS, StepHandler } from './steps/step-handler';
import { ALL_STEP_HANDLERS } from './steps/step-handlers';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsRepository } from './workflows.repository';
import { WorkflowsService } from './workflows.service';

@Module({
  imports: [PeopleModule, EnrichmentModule, SequencesModule, AgentsModule],
  controllers: [WorkflowsController],
  providers: [
    ...ALL_STEP_HANDLERS,
    {
      // To add a new block type: write a StepHandler class and add it to ALL_STEP_HANDLERS.
      provide: STEP_HANDLERS,
      useFactory: (...handlers: StepHandler[]) => handlers,
      inject: ALL_STEP_HANDLERS,
    },
    WorkflowsRepository,
    WorkflowEngineService,
    WorkflowsService,
  ],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}