
export type Operator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'in' | 'isEmpty' | 'isNotEmpty';

export type Condition =
  | { field: string; op: Operator; value?: unknown }
  | { all: Condition[] }
  | { any: Condition[] };

const OPERATORS: Operator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'isEmpty', 'isNotEmpty'];

function getField(obj: unknown, path: string): unknown {
  return path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), obj);
}

export function evaluate(cond: Condition, record: unknown): boolean {
  if ('all' in cond) return cond.all.every((c) => evaluate(c, record));
  if ('any' in cond) return cond.any.some((c) => evaluate(c, record));

  const v = getField(record, cond.field);
  const target = cond.value as any;
  switch (cond.op) {
    case 'eq': return v === target;
    case 'neq': return v !== target;
    case 'gt': return Number(v) > Number(target);
    case 'gte': return Number(v) >= Number(target);
    case 'lt': return Number(v) < Number(target);
    case 'lte': return Number(v) <= Number(target);
    case 'contains': return String(v ?? '').toLowerCase().includes(String(target).toLowerCase());
    case 'in': return Array.isArray(target) && target.includes(v);
    case 'isEmpty': return v === undefined || v === null || v === '' || v === 0;
    case 'isNotEmpty': return !(v === undefined || v === null || v === '' || v === 0);
  }
}

/** Returns an error message, or null if the condition is valid. */
export function validateCondition(cond: any, path = 'condition'): string | null {
  if (!cond || typeof cond !== 'object') return `${path} must be an object`;
  for (const key of ['all', 'any'] as const) {
    if (key in cond) {
      if (!Array.isArray(cond[key]) || cond[key].length === 0) return `${path}.${key} must be a non-empty array`;
      for (let i = 0; i < cond[key].length; i++) {
        const err = validateCondition(cond[key][i], `${path}.${key}[${i}]`);
        if (err) return err;
      }
      return null;
    }
  }
  if (typeof cond.field !== 'string' || !cond.field) return `${path}.field is required`;
  if (!OPERATORS.includes(cond.op)) return `${path}.op must be one of ${OPERATORS.join(', ')}`;
  return null;
}