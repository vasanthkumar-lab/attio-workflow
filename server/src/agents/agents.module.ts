import { Module } from '@nestjs/common';
import { WebAgentService } from './web-agent.service';

@Module({
  providers: [WebAgentService],
  exports: [WebAgentService],
})
export class AgentsModule {}
