import { fieldDef, fieldLabel, operatorDef, operatorsFor } from "./catalog";
import { isGroup, groupKey, type Condition, type LeafCondition, type Operator } from "./types";

export type Join = "all" | "any";

export interface ConditionRows {
  join: Join;
  rows: LeafCondition[];
}

export const emptyLeaf = (): LeafCondition => ({ field: "stage", op: "eq", value: "" });

/**
 * Flattens a condition into the rows the builder edits. Nested groups are flattened one
 * level, which covers everything the builder can produce; deeper nesting written through
 * the API keeps working on the server, it just reads as a flat list here.
 */
export function toRows(condition?: Condition): ConditionRows {
  if (!condition) return { join: "all", rows: [] };
  if (!isGroup(condition)) return { join: "all", rows: [condition] };

  const join = groupKey(condition);
  const children = (condition as Record<Join, Condition[]>)[join];
  const rows: LeafCondition[] = [];
  for (const child of children) {
    if (isGroup(child)) {
      const inner = toRows(child);
      rows.push(...inner.rows);
    } else {
      rows.push(child);
    }
  }
  return { join, rows };
}

/** The inverse of toRows. One row stays a bare leaf so the saved JSON stays readable. */
export function fromRows({ join, rows }: ConditionRows): Condition | undefined {
  const usable = rows.filter((r) => r.field);
  if (usable.length === 0) return undefined;
  if (usable.length === 1) return usable[0];
  return join === "all" ? { all: usable } : { any: usable };
}

/** Keeps a row valid when its field changes: swaps in an operator the new kind supports. */
export function reconcileRow(row: LeafCondition, nextField: string): LeafCondition {
  const kind = fieldDef(nextField)?.kind ?? "text";
  const allowed = operatorsFor(kind);
  const op: Operator = allowed.some((o) => o.op === row.op) ? row.op : allowed[0].op;
  return { field: nextField, op, value: operatorDef(op).takesValue ? row.value ?? "" : undefined };
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

/** "Score is at least 50" - used for node summaries and read-only chips. */
export function describeCondition(condition?: Condition): string {
  if (!condition) return "No condition";
  if (isGroup(condition)) {
    const join = groupKey(condition);
    const children = (condition as Record<Join, Condition[]>)[join];
    const separator = join === "all" ? " and " : " or ";
    return children.map(describeCondition).join(separator);
  }
  const op = operatorDef(condition.op);
  const label = `${fieldLabel(condition.field)} ${op.label}`;
  return op.takesValue ? `${label} ${formatValue(condition.value)}` : label;
}

/** Parses what the user typed into the value box, given the field and operator. */
export function parseValue(raw: string, field: string, op: Operator): unknown {
  const kind = fieldDef(field)?.kind ?? "text";
  if (op === "in") {
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    return kind === "number" ? parts.map(Number).filter((n) => !Number.isNaN(n)) : parts;
  }
  if (kind === "number") {
    const n = Number(raw);
    return raw === "" || Number.isNaN(n) ? raw : n;
  }
  return raw;
}

export function valueToInput(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined || value === null) return "";
  return String(value);
}
