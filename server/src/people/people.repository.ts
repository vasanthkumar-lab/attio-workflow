import { Injectable } from '@nestjs/common';
import { Person } from './person.entity';

/** In-memory storage. Everything is lost when the process restarts. */
@Injectable()
export class PeopleRepository {
  private readonly rows = new Map<string, Person>();

  async insert(p: Person): Promise<Person> {
    this.rows.set(p.id, structuredClone(p));
    return structuredClone(p);
  }

  async findById(id: string): Promise<Person | undefined> {
    const p = this.rows.get(id);
    return p ? structuredClone(p) : undefined;
  }

  async findByEmail(email: string): Promise<Person | undefined> {
    for (const p of this.rows.values()) if (p.email === email) return structuredClone(p);
    return undefined;
  }

  async save(p: Person): Promise<Person> {
    p.updatedAt = new Date().toISOString();
    this.rows.set(p.id, structuredClone(p));
    return structuredClone(p);
  }

  async findAll(): Promise<Person[]> {
    return [...this.rows.values()].map((p) => structuredClone(p));
  }
}
