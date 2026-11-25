import { Inject, Injectable, Logger } from '@nestjs/common';
import { Person } from '../people/person.entity';
import { ENRICHMENT_PROVIDERS, EnrichmentProvider } from './enrichment.provider';

/**
 * Waterfall enrichment: providers run in order (free first, paid last).
 * One provider failing does not stop the others.
 */
@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(@Inject(ENRICHMENT_PROVIDERS) private readonly providers: EnrichmentProvider[]) {}

  async enrich(person: Person, timeoutMs = 8000): Promise<string[]> {
    const log: string[] = [];
    for (const provider of this.providers) {
      try {
        await provider.enrich(person, AbortSignal.timeout(timeoutMs));
        log.push(`${provider.name}: ok`);
      } catch (e: any) {
        log.push(`${provider.name}: ${e?.message ?? e}`);
        this.logger.debug(`${provider.name} failed for ${person.email}: ${e?.message}`);
      }
    }
    person.enrichedAt = new Date().toISOString();
    return log;
  }
}