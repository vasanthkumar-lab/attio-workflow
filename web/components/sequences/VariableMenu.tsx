"use client";

import { useState } from "react";
import { Braces } from "lucide-react";
import { Input, Menu } from "@/components/ui";
import { PERSON_FIELDS } from "@/lib/catalog";


export function VariableMenu({ onInsert }: { onInsert: (token: string) => void }) {
  const [fallback, setFallback] = useState("");

  return (
    <Menu
      align="left"
      className="w-72"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          title="Insert a variable"
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-muted transition-colors hover:bg-line/70 hover:text-ink"
        >
          <Braces size={14} />
          Variable
        </button>
      )}
    >
      <div className="px-2 pb-2 pt-1">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-faint">
          Fallback (optional)
        </label>
        <Input
          value={fallback}
          placeholder="e.g. there"
          onChange={(e) => setFallback(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="h-8"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Used when the attribute is empty, so the email still sends.
        </p>
      </div>

      <div className="max-h-64 overflow-y-auto border-t border-line pt-1">
        {PERSON_FIELDS.filter((f) => f.variable).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() =>
              onInsert(fallback.trim() ? `{{${f.key} | ${fallback.trim()}}}` : `{{${f.key}}}`)
            }
            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink transition-colors hover:bg-canvas"
          >
            {f.label}
            <code className="font-mono text-[11px] text-faint">{`{{${f.key}}}`}</code>
          </button>
        ))}
      </div>
    </Menu>
  );
}
