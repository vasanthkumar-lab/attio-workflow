import { Injectable } from '@nestjs/common';
import { Person } from '../../people/person.entity';
import { EnrichmentProvider, setIfEmpty } from '../enrichment.provider';

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'live.com',
  'icloud.com', 'proton.me', 'protonmail.com', 'rediffmail.com', 'aol.com',
]);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Free and offline: company domain + name guess from the email address. */
@Injectable()
export class EmailProvider implements EnrichmentProvider {
  readonly name = 'email';

  async enrich(p: Person) {
    const [local, domain] = p.email.toLowerCase().split('@');
    if (!domain) throw new Error(`invalid email ${p.email}`);

    // priya.sharma -> Priya Sharma (only when it clearly looks like first.last)
    const parts = local.split(/[._-]/).filter((s) => /^[a-z]{2,}$/.test(s));
    if (parts.length >= 2) setIfEmpty(p, 'name', parts.map(capitalize).join(' '));
    if (!FREE_EMAIL_DOMAINS.has(domain)) setIfEmpty(p, 'domain', domain);
    if (p.name) setIfEmpty(p, 'firstName', p.name.split(' ')[0]);
  }
}