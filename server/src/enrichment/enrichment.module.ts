import { Module } from '@nestjs/common';
import { ENRICHMENT_PROVIDERS } from './enrichment.provider';
import { EnrichmentService } from './enrichment.service';
import { ApiProvider } from './providers/api.provider';
import { DomainFallbackProvider } from './providers/domain-fallback.provider';
import { EmailProvider } from './providers/email.provider';
import { WebsiteProvider } from './providers/website.provider';

@Module({
  providers: [
    EmailProvider,
    WebsiteProvider,
    ApiProvider,
    DomainFallbackProvider,
    {
      // The ORDER here is the waterfall order.
      provide: ENRICHMENT_PROVIDERS,
      useFactory: (email: EmailProvider, web: WebsiteProvider, api: ApiProvider, fallback: DomainFallbackProvider) => [
        email,
        web,
        api,
        fallback,
      ],
      inject: [EmailProvider, WebsiteProvider, ApiProvider, DomainFallbackProvider],
    },
    EnrichmentService,
  ],
  exports: [EnrichmentService],
})
export class EnrichmentModule {}