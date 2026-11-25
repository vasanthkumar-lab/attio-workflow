import { Injectable } from '@nestjs/common';
import { Person } from '../../people/person.entity';
import { EnrichmentProvider, setIfEmpty } from '../enrichment.provider';

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

function meta(html: string, attr: 'name' | 'property', key: string): string | undefined {
  // Handles both attribute orders: <meta name="x" content="y"> and <meta content="y" name="x">
  const a = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i').exec(html);
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`, 'i').exec(html);
  const m = a ?? b;
  return m ? decode(m[1]) : undefined;
}

/** Free: reads the company homepage for name, description and LinkedIn link. */
@Injectable()
export class WebsiteProvider implements EnrichmentProvider {
  readonly name = 'website';

  async enrich(p: Person, signal: AbortSignal) {
    if (!p.domain) throw new Error('no company domain (personal email?)');
    const res = await fetch(`https://${p.domain}`, {
      signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'crm-enricher/1.0' },
    });
    if (!res.ok) throw new Error(`homepage returned ${res.status}`);
    const html = (await res.text()).slice(0, 1_000_000);

    let company = meta(html, 'property', 'og:site_name');
    if (!company) {
      const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
      company = title ? decode(title).split(/\s[|\-–—:]\s/)[0] : undefined;
    }
    setIfEmpty(p, 'company', company);
    setIfEmpty(p, 'description', meta(html, 'name', 'description') ?? meta(html, 'property', 'og:description'));
    setIfEmpty(p, 'linkedinUrl', /https:\/\/(?:www\.)?linkedin\.com\/company\/[\w-]+/i.exec(html)?.[0]);
  }
}