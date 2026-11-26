"use client";

import Link from "next/link";
import { Clock, Mail } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { cx } from "@/lib/format";
import type { Sequence } from "@/lib/types";

const MAX_NODES = 7;

type Node = "email" | "wait";

/** The shape of the sequence as a row of icons: an email per step, a clock for each wait. */
function nodesFor(sequence: Sequence): Node[] {
  const nodes: Node[] = [];
  sequence.steps.forEach((step, i) => {
    if (i > 0 && step.waitBusinessDays > 0) nodes.push("wait");
    nodes.push("email");
  });
  return nodes;
}

export function FavoriteCard({ sequence }: { sequence: Sequence }) {
  const all = nodesFor(sequence);
  const nodes = all.slice(0, MAX_NODES);

  return (
    <Link href={`/sequences/${sequence.id}`} className="group block">
      <Card className="h-full overflow-hidden transition-colors group-hover:border-line-strong">
        <div className="canvas-grid flex h-24 items-center justify-center border-b border-line px-3">
          {nodes.map((node, i) => (
            <span key={i} className="flex items-center">
              {i > 0 && <span className="h-px w-3 shrink-0 bg-line-strong" />}
              <span
                className={cx(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1",
                  node === "email"
                    ? "bg-accent-soft text-accent-ink ring-accent/25"
                    : "bg-warn-soft text-warn ring-warn/25",
                )}
              >
                {node === "email" ? <Mail size={13} /> : <Clock size={13} />}
              </span>
            </span>
          ))}
          {all.length > nodes.length && (
            <span className="ml-1.5 text-[12px] text-muted">+{all.length - nodes.length}</span>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
            {sequence.name}
          </span>
          <Badge tone={sequence.enabled ? "good" : "muted"}>
            {sequence.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </Card>
    </Link>
  );
}
