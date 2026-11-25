import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '../common/id';
import { WorkflowEngineService } from './workflow-engine.service';
import { Workflow } from './workflow.types';
import { validateWorkflowInput } from './workflow.validation';
import { WorkflowsRepository } from './workflows.repository';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly repo: WorkflowsRepository,
    private readonly engine: WorkflowEngineService,
  ) {}

  private build(input: any, existing?: Workflow): Workflow {
    validateWorkflowInput(input);
    const now = new Date().toISOString();
    return {
      id: existing?.id ?? newId('wf'),
      name: input.name.trim(),
      description: input.description,
      enabled: input.enabled ?? existing?.enabled ?? false,
      trigger: input.trigger,
      steps: input.steps,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  create(input: any) { return this.repo.save(this.build(input)); }
  async update(id: string, input: any) { return this.repo.save(this.build(input, await this.get(id))); }
  list() { return this.repo.list(); }

  async delete(id: string) {
    await this.get(id);
    await this.repo.delete(id);
    return { id, deleted: true };
  }

  async get(id: string) {
    const w = await this.repo.find(id);
    if (!w) throw new NotFoundException(`workflow ${id} not found`);
    return w;
  }

  async setEnabled(id: string, enabled: boolean) {
    const w = await this.get(id);
    w.enabled = enabled;
    w.updatedAt = new Date().toISOString();
    return this.repo.save(w);
  }

  /** "Run now" for one person, works even if the workflow is disabled (useful for testing). */
  async runNow(id: string, personId: string) {
    return (await this.engine.run(await this.get(id), personId, 'manual')) ?? { skipped: 'person did not match trigger condition' };
  }

  listRuns(filter: { workflowId?: string; personId?: string }) { return this.repo.listRuns(filter); }

  async getRun(id: string) {
    const r = await this.repo.findRun(id);
    if (!r) throw new NotFoundException(`run ${id} not found`);
    return r;
  }
}