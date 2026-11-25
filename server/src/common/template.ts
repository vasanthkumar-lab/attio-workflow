
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/{{\s*([\w.]+)\s*(?:\|\s*([^}]*?)\s*)?}}/g, (_m, path: string, fallback?: string) => {
    const value = path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), data);
    if (value === undefined || value === null || value === '') return fallback ?? '';
    return String(value);
  });
}

/** Lists placeholders that have no value and no fallback, so we never send "Hi ,". */
export function missingFields(template: string, data: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const m of template.matchAll(/{{\s*([\w.]+)\s*(\|[^}]*)?}}/g)) {
    if (m[2]) continue;
    const value = m[1].split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), data);
    if (value === undefined || value === null || value === '') missing.push(m[1]);
  }
  return missing;
}