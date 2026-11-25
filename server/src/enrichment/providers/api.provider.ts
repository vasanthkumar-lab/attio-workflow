import { Injectable } from '@nestjs/common';
import { Person } from '../../people/person.entity';
import { EnrichmentProvider, setIfEmpty } from '../enrichment.provider';

/**
 * Paid data provider (Apollo, People Data Labs, Clearbit-style).
 * Runs after the free providers and only when important fields are still missing,
 * so you don't spend credits unnecessarily.
 *
 * Adjust the URL and the response mapping to match your provider's API.
 */
@Injectable()
export class ApiProvider implements EnrichmentProvider {
  readonly name = 'data-api';
  private readonly url = process.env.ENRICH_API_URL;
  private readonly key = process.env.ENRICH_API_KEY;

  async enrich(p: Person, signal: AbortSignal) {
    if (!this.url || !this.key) throw new Error('not configured, skipped');
    if (p.title && p.industry && p.companySize) return; // nothing missing

    const res = await fetch(`${this.url}?email=${encodeURIComponent(p.email)}`, {
      signal,
      headers: { Authorization: `Bearer ${this.key}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`provider returned ${res.status}`);
    const d: any = await res.json();

    setIfEmpty(p, 'name', d.full_name);
    setIfEmpty(p, 'title', d.job_title);
    setIfEmpty(p, 'company', d.company_name);
    setIfEmpty(p, 'industry', d.industry);
    setIfEmpty(p, 'companySize', typeof d.company_size === 'number' ? d.company_size : undefined);
    setIfEmpty(p, 'location', d.location);
    setIfEmpty(p, 'linkedinUrl', d.linkedin_url);
  }
}