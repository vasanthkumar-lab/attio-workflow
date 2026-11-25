import { Person } from '../people/person.entity';

/**
 * One source of data. Must only fill fields that are still empty,
 * so the order of providers decides who "wins".
 */
export interface EnrichmentProvider {
  readonly name: string;
  enrich(person: Person, signal: AbortSignal): Promise<void>;
}

export const ENRICHMENT_PROVIDERS = Symbol('ENRICHMENT_PROVIDERS');

export function setIfEmpty<K extends keyof Person>(p: Person, key: K, value: Person[K] | undefined | null) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return;
  const current = p[key];
  if (current === undefined || current === null || current === '' || current === 0) {
    p[key] = (typeof value === 'string' ? value.trim() : value) as Person[K];
  }
}