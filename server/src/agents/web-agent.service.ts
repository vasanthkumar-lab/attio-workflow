import { Injectable, Logger } from '@nestjs/common';
import { Person } from '../people/person.entity';

/** Attributes the agent is allowed to fill in. Everything else is off limits. */
export const AGENT_FIELDS = [
  'name',
  'title',
  'company',
  'domain',
  'industry',
  'companySize',
  'location',
  'linkedinUrl',
  'description',
] as const;

export type AgentField = (typeof AGENT_FIELDS)[number];

const FIELD_HINTS: Record<AgentField, string> = {
  name: 'Full name of the person.',
  title: 'Their current job title.',
  company: 'The company they work at.',
  domain: 'The company website domain, no scheme, e.g. acme.com',
  industry: 'One or two words, e.g. "Software" or "Staffing".',
  companySize: 'Approximate headcount, digits only, e.g. 180',
  location: 'City and country.',
  linkedinUrl: 'Full https URL to a LinkedIn profile or company page.',
  description: 'One sentence on what the company does.',
};

const NUMERIC_FIELDS: AgentField[] = ['companySize'];

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
/**
 * Paid, but barely: roughly $0.0001 of tokens per record, against ~$0.007 for the web
 * search on the same request. A free model saves about one percent of the bill and
 * costs you a 429 whenever its shared pool is busy, which is a poor trade.
 */
const DEFAULT_MODEL = 'mistralai/mistral-nemo';

/**
 * Tried in order when the one above is unavailable, so a provider outage degrades the
 * run instead of failing it. Free, and billing follows whichever model actually served.
 */
const DEFAULT_FALLBACKS = ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-lightning:free'];

/** OpenRouter rejects a longer `models` array with a 400, primary included. */
const MAX_MODELS = 3;
const TOOL_NAME = 'save_findings';
const SEARCH_RESULTS = 5;

const SYSTEM = `You research people and companies for a sales CRM.

Web search results for this record are included in the conversation. Read them, then report what you found by calling the ${TOOL_NAME} function.

Rules:
- Only report a value that appears in the search results. Never guess, and never infer a value from the shape of an email address alone.
- Leave a field as an empty string when the results do not confirm it. An empty field is a correct answer; an invented one corrupts the CRM.
- Prefer the company's own site and LinkedIn over directories and aggregators.
- Keep every value short and plain, with no markdown, quotes or trailing punctuation.`;

/**
 * A comma-separated env var, or the default when it is unset, blank or all commas.
 * Declaring `NAME=` with no value is the common case, and it must not read as "none".
 */
function envList(raw: string | undefined, fallback: string[]): string[] {
  const parsed = (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
}

export interface AgentFindings {
  values: Partial<Record<AgentField, string | number>>;
  sources: string[];
  notes?: string;
  /** The model that actually answered, which is not the primary after a fallback. */
  servedBy?: string;
}

/** The slice of OpenRouter's response this service reads. */
interface Annotation {
  type?: string;
  url_citation?: { url?: string };
}

interface ChatResponse {
  error?: { message?: string };
  model?: string;
  choices?: {
    message?: {
      content?: string | null;
      annotations?: Annotation[];
      tool_calls?: { function?: { name?: string; arguments?: string } }[];
    };
  }[];
}

/**
 * The "Web agent" workflow block, running through OpenRouter.
 *
 * The `web` plugin searches before the model generates and prepends the results, so
 * this is one request rather than an agentic loop: search, read, report. The answer
 * comes back through a forced function call, so its shape is guaranteed rather than
 * parsed out of prose.
 */
@Injectable()
export class WebAgentService {
  private readonly logger = new Logger(WebAgentService.name);
  private readonly apiKey = process.env.OPENROUTER_API_KEY?.trim();
  // `||`, not `??`: an env file that declares OPENROUTER_MODEL= with no value gives an
  // empty string, which `??` would happily pass through as the model name.
  private readonly model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;

  /**
   * Primary first, then fallbacks: deduped so a repeated id never costs a hop, and
   * truncated because OpenRouter 400s on more than MAX_MODELS.
   */
  private readonly models = [
    ...new Set([this.model, ...envList(process.env.OPENROUTER_FALLBACKS, DEFAULT_FALLBACKS)]),
  ].slice(0, MAX_MODELS);

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  async research(
    person: Person,
    instruction: string,
    fields: AgentField[],
  ): Promise<AgentFindings> {
    if (!this.apiKey) throw new Error('OPENROUTER_API_KEY is not set');
    if (!fields.length) throw new Error('no attributes selected');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    // Optional attribution, shown on OpenRouter's app leaderboards.
    if (process.env.OPENROUTER_APP_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_APP_URL;
    if (process.env.OPENROUTER_APP_TITLE) headers['X-Title'] = process.env.OPENROUTER_APP_TITLE;

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: this.model,
        // Falls through to the next id when one is rate limited or down. The response
        // reports which one actually answered.
        models: this.models,
        max_tokens: 2000,
        // Runs the search and prepends the results. The user message below is what
        // gets searched, so it reads like a query rather than a set of instructions.
        plugins: [{ id: 'web', max_results: SEARCH_RESULTS }],
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: this.prompt(person, instruction) },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: TOOL_NAME,
              description: 'Report what the search results confirmed about this record.',
              parameters: this.schemaFor(fields),
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: TOOL_NAME } },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      if (res.status === 429) {
        throw new Error(
          `every model is rate limited (${this.models.join(', ')}). Free endpoints share an ` +
            `upstream pool, so set OPENROUTER_MODEL to a paid model, add paid ids to ` +
            `OPENROUTER_FALLBACKS, or bring your own provider key. ${detail.slice(0, 200)}`,
        );
      }
      throw new Error(`OpenRouter returned ${res.status}: ${detail.slice(0, 300)}`);
    }

    const body = (await res.json()) as ChatResponse;
    if (body.error) throw new Error(body.error.message ?? 'OpenRouter returned an error');

    const message = body.choices?.[0]?.message;
    const call = message?.tool_calls?.find((c) => c.function?.name === TOOL_NAME);

    if (!call?.function?.arguments) {
      // A model that ignored tool_choice, or one that does not support tools at all.
      const said = message?.content?.trim().slice(0, 200);
      throw new Error(
        said
          ? `the model replied with text instead of calling ${TOOL_NAME}: ${said}`
          : `the model did not call ${TOOL_NAME}; does "${this.model}" support tool calling?`,
      );
    }

    // OpenRouter follows the OpenAI shape, where arguments is a JSON *string*.
    let parsed: unknown;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      throw new Error('the model returned arguments that are not valid JSON');
    }

    return { ...this.toFindings(parsed, fields, message?.annotations), servedBy: body.model };
  }

  private prompt(person: Person, instruction: string): string {
    const known = Object.entries({
      email: person.email,
      name: person.name,
      title: person.title,
      company: person.company,
      domain: person.domain,
      location: person.location,
    })
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return `Research this CRM record.\n\n${known}\n\nWhat to find out:\n${instruction.trim()}`;
  }

  /**
   * Built per block, because the attributes to fill are chosen in the UI. Every value
   * is a string so the schema needs no nullable union: empty means "not found", and
   * numbers are coerced on the way out.
   */
  private schemaFor(fields: AgentField[]) {
    const properties: Record<string, unknown> = {};
    for (const field of fields) {
      properties[field] = {
        type: 'string',
        description: `${FIELD_HINTS[field]} Empty string if the results do not confirm it.`,
      };
    }
    properties.sources = {
      type: 'array',
      items: { type: 'string' },
      description: 'URLs of the pages the values came from.',
    };
    properties.notes = {
      type: 'string',
      description: 'One short line on anything notable, or an empty string.',
    };

    return {
      type: 'object' as const,
      properties,
      required: [...fields, 'sources', 'notes'],
      additionalProperties: false,
    };
  }

  private toFindings(
    raw: unknown,
    fields: AgentField[],
    annotations?: Annotation[],
  ): AgentFindings {
    const input = (raw ?? {}) as Record<string, unknown>;
    const values: Partial<Record<AgentField, string | number>> = {};

    for (const field of fields) {
      const text = typeof input[field] === 'string' ? (input[field] as string).trim() : '';
      if (!text) continue;

      if (NUMERIC_FIELDS.includes(field)) {
        const digits = Number(text.replace(/[^\d]/g, ''));
        if (Number.isFinite(digits) && digits > 0) values[field] = digits;
        continue;
      }
      values[field] = text;
    }

    // Prefer the search engine's own citations - they are what was actually fetched,
    // rather than URLs the model wrote out and may have mistyped.
    const cited = (annotations ?? [])
      .filter((a) => a.type === 'url_citation' && a.url_citation?.url)
      .map((a) => a.url_citation!.url!);
    const claimed = Array.isArray(input.sources)
      ? input.sources.filter((s): s is string => typeof s === 'string')
      : [];
    const sources = [...new Set(cited.length ? cited : claimed)].slice(0, 5);

    const notes =
      typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim() : undefined;

    return { values, sources, notes };
  }
}
