import type { Person } from "./types";

/**
 * Mirrors server/src/common/template.ts so the composer can preview an email exactly as
 * the sequence runner will render it.
 */
const TOKEN = /\{\{\s*([\w.]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g;

function read(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]),
    data,
  );
}

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(TOKEN, (_m, path: string, fallback?: string) => {
    const value = read(data, path);
    if (value === undefined || value === null || value === "") return fallback ?? "";
    return String(value);
  });
}

/** Placeholders with no value and no fallback. These pause an enrollment on the server. */
export function missingFields(template: string, data: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const m of template.matchAll(/\{\{\s*([\w.]+)\s*(\|[^}]*)?\}\}/g)) {
    if (m[2]) continue;
    const value = read(data, m[1]);
    if (value === undefined || value === null || value === "") missing.push(m[1]);
  }
  return missing;
}

/** The record the runner builds: the person plus a derived firstName. */
export function previewData(person: Person): Record<string, unknown> {
  return { ...person, firstName: person.firstName ?? person.name?.split(" ")[0] };
}

/** A stand-in record used when there is nobody to preview against yet. */
export const SAMPLE_PERSON: Person = {
  id: "sample",
  email: "priya@acme.com",
  name: "Priya Sharma",
  firstName: "Priya",
  title: "Head of Talent",
  company: "Acme",
  domain: "acme.com",
  industry: "Software",
  companySize: 180,
  location: "Bengaluru",
  score: 75,
  segment: "priority",
  owner: "you@yourcompany.com",
  stage: "lead",
  tags: ["inbound"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
