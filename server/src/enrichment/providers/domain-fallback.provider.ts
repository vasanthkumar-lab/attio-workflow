import { Injectable } from '@nestjs/common';
import { Person } from '../../people/person.entity';
import { EnrichmentProvider, setIfEmpty } from '../enrichment.provider';

/** Last resort: "greenleaf.io" -> "Greenleaf". */
@Injectable()
export class DomainFallbackProvider implements EnrichmentProvider {
  readonly name = 'domain-fallback';

  async enrich(p: Person) {
    if (p.company || !p.domain) return;
    const base = p.domain.replace(/^www\./, '').split('.')[0];
    if (base) setIfEmpty(p, 'company', base.charAt(0).toUpperCase() + base.slice(1));
  }
}