"use client";

import { Plus, X } from "lucide-react";
import { Button, IconButton, Input, Select } from "@/components/ui";
import { PERSON_FIELDS, fieldDef, operatorDef, operatorsFor } from "@/lib/catalog";
import {
  emptyLeaf, fromRows, parseValue, reconcileRow, toRows, valueToInput, type Join,
} from "@/lib/conditions";
import type { Condition, LeafCondition, Operator } from "@/lib/types";
import { cx, humanize } from "@/lib/format";

/**
 * The shared condition builder, used by workflow triggers, If blocks, score rules and
 * sequence exit criteria. Rows are joined by a single and/or toggle, like Attio's
 * basic condition builder.
 */
export function ConditionBuilder({
  value,
  onChange,
  addLabel = "Add condition",
  allowEmpty = true,
  className,
}: {
  value?: Condition;
  onChange: (next: Condition | undefined) => void;
  addLabel?: string;
  /** When false, the last row cannot be removed (If blocks always need a condition). */
  allowEmpty?: boolean;
  className?: string;
}) {
  const { join, rows } = toRows(value);

  const commit = (nextJoin: Join, nextRows: LeafCondition[]) =>
    onChange(fromRows({ join: nextJoin, rows: nextRows }));

  const updateRow = (index: number, patch: Partial<LeafCondition>) =>
    commit(join, rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {rows.map((row, index) => {
        const kind = fieldDef(row.field)?.kind ?? "text";
        const operators = operatorsFor(kind);
        const op = operatorDef(row.op);
        const options = fieldDef(row.field)?.options;

        return (
          <div key={index} className="flex items-start gap-1.5">
            <div className="w-11 shrink-0 pt-2">
              {index === 0 ? (
                <span className="text-[11px] font-medium text-faint">Where</span>
              ) : (
                <button
                  type="button"
                  onClick={() => commit(join === "all" ? "any" : "all", rows)}
                  className="rounded border border-line-strong bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted hover:bg-canvas"
                >
                  {join === "all" ? "and" : "or"}
                </button>
              )}
            </div>

            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
              <Select
                aria-label="Attribute"
                value={row.field}
                onChange={(e) => updateRow(index, reconcileRow(row, e.target.value))}
              >
                {PERSON_FIELDS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </Select>

              <Select
                aria-label="Operator"
                value={row.op}
                onChange={(e) => {
                  const nextOp = e.target.value as Operator;
                  updateRow(index, {
                    op: nextOp,
                    value: operatorDef(nextOp).takesValue ? row.value ?? "" : undefined,
                  });
                }}
              >
                {operators.map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.label}
                  </option>
                ))}
              </Select>

              {op.takesValue && (
                <div className="col-span-2">
                  {options && row.op !== "in" ? (
                    <Select
                      aria-label="Value"
                      value={valueToInput(row.value)}
                      onChange={(e) => updateRow(index, { value: e.target.value })}
                    >
                      <option value="">Choose a value</option>
                      {options.map((o) => (
                        <option key={o} value={o}>
                          {humanize(o)}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      aria-label="Value"
                      value={valueToInput(row.value)}
                      placeholder={
                        row.op === "in"
                          ? "Comma-separated, e.g. customer, meeting_booked"
                          : kind === "number"
                            ? "Number"
                            : "Value"
                      }
                      onChange={(e) =>
                        updateRow(index, { value: parseValue(e.target.value, row.field, row.op) })
                      }
                    />
                  )}
                </div>
              )}
            </div>

            <div className="pt-1">
              <IconButton
                label="Remove condition"
                disabled={!allowEmpty && rows.length === 1}
                onClick={() => commit(join, rows.filter((_, i) => i !== index))}
              >
                <X size={14} />
              </IconButton>
            </div>
          </div>
        );
      })}

      <div>
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus size={14} />}
          onClick={() => commit(join, [...rows, emptyLeaf()])}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
