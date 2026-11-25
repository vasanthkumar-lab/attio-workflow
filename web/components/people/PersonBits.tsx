"use client";

import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";
import type { Tone } from "@/lib/catalog";
import { cx, displayName, humanize, initials } from "@/lib/format";
import type { Person } from "@/lib/types";

const STAGE_TONE: Record<string, Tone> = {
  lead: "muted",
  contacted: "accent",
  meeting_booked: "violet",
  customer: "good",
  closed_lost: "bad",
};

export function StageBadge({ stage }: { stage: string }) {
  return <Badge tone={STAGE_TONE[stage] ?? "muted"}>{humanize(stage)}</Badge>;
}

export function SegmentBadge({ segment }: { segment?: string }) {
  if (!segment) return <span className="text-faint">&mdash;</span>;
  return <Badge tone={segment === "priority" ? "good" : "muted"}>{humanize(segment)}</Badge>;
}

/** A 0-100 score with a small bar, so lists are scannable. */
export function ScorePill({ score }: { score?: number }) {
  if (score === undefined || score === null) return <span className="text-faint">&mdash;</span>;
  const tone = score >= 50 ? "bg-good" : score >= 25 ? "bg-warn" : "bg-line-strong";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1 w-10 overflow-hidden rounded-full bg-line">
        <span className={cx("block h-full rounded-full", tone)} style={{ width: `${score}%` }} />
      </span>
      <span className="tabular-nums text-[13px] text-ink">{score}</span>
    </span>
  );
}

export function PersonCell({ person, href }: { person: Person; href?: string }) {
  const content = (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar initials={initials(person)} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-ink">
          {displayName(person)}
        </span>
        <span className="block truncate text-[12px] text-muted">{person.email}</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="block min-w-0 hover:underline">
      {content}
    </Link>
  ) : (
    content
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className="text-faint">&mdash;</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="rounded bg-canvas px-1.5 py-0.5 text-[11px] text-muted ring-1 ring-line"
        >
          {t}
        </span>
      ))}
    </span>
  );
}
