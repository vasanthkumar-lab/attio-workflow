import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CrmEvent, Events } from '../common/events';
import { newId } from '../common/id';
import { CreatePersonDto, UpdatePersonDto } from './people.dto';
import { PeopleRepository } from './people.repository';
import { Person } from './person.entity';

@Injectable()
export class PeopleService {
  constructor(
    private readonly repo: PeopleRepository,
    private readonly events: EventEmitter2,
  ) {}

  async create(dto: CreatePersonDto): Promise<Person> {
    const email = dto.email.trim().toLowerCase();
    if (await this.repo.findByEmail(email)) throw new ConflictException(`${email} already exists`);
    const now = new Date().toISOString();
    const person = await this.repo.insert({
      ...dto,
      id: newId('per'),
      email,
      stage: dto.stage ?? 'lead',
      tags: dto.tags ?? [],
      createdAt: now,
      updatedAt: now,
    });
    this.events.emit(Events.PersonCreated, { personId: person.id } satisfies CrmEvent);
    return person;
  }

  async get(id: string): Promise<Person> {
    const p = await this.repo.findById(id);
    if (!p) throw new NotFoundException(`person ${id} not found`);
    return p;
  }

  list() {
    return this.repo.findAll();
  }

  /** Update from a user/API. Emits person.updated so workflows can react. */
  async update(id: string, dto: UpdatePersonDto): Promise<Person> {
    const person = await this.get(id);
    // Only apply fields that were actually sent, so missing fields are never wiped.
    const changes = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
    const changedFields = Object.keys(changes).filter((k) => JSON.stringify((person as any)[k]) !== JSON.stringify(changes[k]));
    Object.assign(person, changes);
    const saved = await this.repo.save(person);
    if (changedFields.length) {
      this.events.emit(Events.PersonUpdated, { personId: id, changedFields } satisfies CrmEvent);
    }
    return saved;
  }

  /**
   * Save from automation (workflows). Deliberately does NOT emit person.updated,
   * otherwise a workflow that updates a person could trigger itself forever.
   */
  saveFromAutomation(person: Person): Promise<Person> {
    return this.repo.save(person);
  }
}