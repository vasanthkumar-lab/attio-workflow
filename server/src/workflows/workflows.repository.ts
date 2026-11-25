import { Injectable } from '@nestjs/common';
import { Workflow, WorkflowRun } from './workflow.types';

/** In-memory storage; swap for Prisma/TypeORM in production. */
@Injectable()
export class WorkflowsRepository {
  private readonly workflows = new Map<string, Workflow>();
  private readonly runs = new Map<string, WorkflowRun>();

  async save(w: Workflow) { this.workflows.set(w.id, structuredClone(w)); return structuredClone(w); }
  async find(id: string) { const w = this.workflows.get(id); return w ? structuredClone(w) : undefined; }
  async list() { return [...this.workflows.values()].map((w) => structuredClone(w)); }
  async delete(id: string) { return this.workflows.delete(id); }
  async findByEvent(event: string) {
    return [...this.workflows.values()].filter((w) => w.enabled && w.trigger.event === event).map((w) => structuredClone(w));
  }

  async saveRun(r: WorkflowRun) { this.runs.set(r.id, structuredClone(r)); return structuredClone(r); }
  async findRun(id: string) { const r = this.runs.get(id); return r ? structuredClone(r) : undefined; }
  async listRuns(filter: { workflowId?: string; personId?: string }) {
    return [...this.runs.values()]
      .filter((r) => (!filter.workflowId || r.workflowId === filter.workflowId) && (!filter.personId || r.personId === filter.personId))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((r) => structuredClone(r));
  }
}