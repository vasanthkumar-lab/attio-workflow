import { describeCondition } from "@/lib/conditions";
import { fieldLabel } from "@/lib/catalog";
import { pluralize } from "@/lib/format";
import type { Sequence, WorkflowStep } from "@/lib/types";

/** The one-line description shown under a block's name on the canvas. */
export function blockSummary(
  step: WorkflowStep,
  sequencesById: Map<string, Sequence>,
): string {
  switch (step.type) {
    case "enrich":
      return "Company, domain, industry and size from the email address";
    case "score":
      return `${pluralize(step.rules.length, "rule")}, up to ${Math.min(
        100,
        step.rules.reduce((n, r) => n + (r.points || 0), 0),
      )} points`;
    case "if":
      return step.label?.trim() || describeCondition(step.condition);
    case "update": {
      const entries = Object.entries(step.fields);
      if (entries.length === 0) return "No attributes set yet";
      return entries
        .map(([key, value]) => `${fieldLabel(key)} = ${String(value)}`)
        .join(", ");
    }
    case "addTag":
      return step.tag ? `Tag "${step.tag}"` : "No tag set yet";
    case "enroll":
      return sequencesById.get(step.sequenceId)?.name ?? "No sequence chosen";
    case "webhook":
      try {
        return step.url ? new URL(step.url).host : "No URL set yet";
      } catch {
        return step.url || "No URL set yet";
      }
  }
}
