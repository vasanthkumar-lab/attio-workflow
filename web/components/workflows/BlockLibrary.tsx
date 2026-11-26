"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, Braces, GitBranch, Globe, Mail, Pencil, Search, Sparkles, Tag, X,
} from "lucide-react";
import { IconButton } from "@/components/ui";
import { BLOCKS, BLOCK_CATEGORIES, TONE_CLASSES } from "@/lib/catalog";
import { cx } from "@/lib/format";
import type { StepType, WorkflowStep } from "@/lib/types";

export const BLOCK_ICONS: Record<StepType, React.ComponentType<{ size?: number }>> = {
  enrich: Sparkles,
  score: Braces,
  if: GitBranch,
  update: Pencil,
  addTag: Tag,
  enroll: Mail,
  webhook: Globe,
  webAgent: Bot,
};

/**
 * The block picker, rendered inline on the canvas where the new block will go -
 * the way Attio drops a "Search blocks" panel at the end of the connector.
 */
export function BlockPicker({
  onPick,
  onCancel,
}: {
  onPick: (step: WorkflowStep) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return BLOCKS.filter(
      (b) =>
        !q ||
        b.label.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q),
    );
  }, [search]);

  const grouped = useMemo(
    () =>
      BLOCK_CATEGORIES.map((category) => ({
        category,
        blocks: matches.filter((b) => b.category === category),
      })).filter((g) => g.blocks.length > 0),
    [matches],
  );

  // Flat order so the arrow keys walk across category headings.
  const ordered = useMemo(() => grouped.flatMap((g) => g.blocks), [grouped]);

  useEffect(() => {
    setHighlight(0);
  }, [search]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, ordered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && ordered[highlight]) {
      e.preventDefault();
      onPick(ordered[highlight].create());
    }
  };

  return (
    <div
      onKeyDown={onKeyDown}
      className="w-[300px] overflow-hidden rounded-xl border border-line-strong bg-surface shadow-pop"
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Search size={14} className="shrink-0 text-faint" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none"
        />
        <IconButton label="Close" onClick={onCancel}>
          <X size={14} />
        </IconButton>
      </div>

      <div className="max-h-80 overflow-y-auto py-1">
        {grouped.length === 0 && (
          <p className="px-3 py-6 text-center text-[13px] text-muted">No blocks match.</p>
        )}

        {grouped.map(({ category, blocks }) => (
          <div key={category} className="mb-1 last:mb-0">
            <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
              {category}
            </p>
            {blocks.map((block) => {
              const Icon = BLOCK_ICONS[block.type];
              const index = ordered.indexOf(block);
              return (
                <button
                  key={block.type}
                  type="button"
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => onPick(block.create())}
                  className={cx(
                    "flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
                    index === highlight ? "bg-raised" : "hover:bg-raised",
                  )}
                >
                  <span
                    className={cx(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-md",
                      TONE_CLASSES[block.tone].chip,
                    )}
                  >
                    <Icon size={13} />
                  </span>
                  <span className="truncate text-[13px] text-ink">{block.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
