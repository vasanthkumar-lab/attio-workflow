import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { IsBoolean, IsString } from 'class-validator';
import { WorkflowsService } from './workflows.service';

class RunNowDto { @IsString() personId: string; }
class SetEnabledDto { @IsBoolean() enabled: boolean; }

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Post() create(@Body() body: any) { return this.workflows.create(body); }
  @Get() list() { return this.workflows.list(); }
  @Get('runs') runs(@Query('workflowId') workflowId?: string, @Query('personId') personId?: string) {
    return this.workflows.listRuns({ workflowId, personId });
  }
  @Get('runs/:runId') run(@Param('runId') runId: string) { return this.workflows.getRun(runId); }
  @Get(':id') get(@Param('id') id: string) { return this.workflows.get(id); }
  @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.workflows.update(id, body); }
  @Patch(':id/enabled') setEnabled(@Param('id') id: string, @Body() dto: SetEnabledDto) { return this.workflows.setEnabled(id, dto.enabled); }
  @Post(':id/run') runNow(@Param('id') id: string, @Body() dto: RunNowDto) { return this.workflows.runNow(id, dto.personId); }
  @Delete(':id') remove(@Param('id') id: string) { return this.workflows.delete(id); }
}