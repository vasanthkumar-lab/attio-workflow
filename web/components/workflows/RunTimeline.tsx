"use client";

import {
  Bot, CircleAlert, CircleCheck, CircleDot, ExternalLink, GitBranch, Globe, Mail,
  Pencil, Sparkles, Tag, Target, Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { TONE_CLASSES, type BlockTone } from "@/lib/catalog";
import { cx } from "@/lib/format";

/**
 * The engine writes its run log as prose, one line per thing it did. This turns those
 * lines back into rows a person can scan. Anything unrecognised falls through to plain
 * text, so a new log line never breaks the view - it just looks plainer until it gets
 * a pattern here.
 */
export interface LogEntry {
  time?: string;
  icon: ReactNode;
  tone: BlockTone;
  title: string;
  detail?: string;
  /** Rendered as a link rather than text. */
  href?: string;
  badge?: { label: string; tone: "good" | "muted" | "bad" | "warn" };
  faded?: boolean;
}

const TIMESTAMP = /^(\d{2}:\d{2}:\d{2})\s+([\s\S]*)$/;
const unquote = (value: string) => value.replace(/^"|"$/g, "");

function classify(text: string): Omit<LogEntry, "time"> {
  let m: RegExpExecArray | null;

  if ((m = /^trigger "(.+?)" for (.+)$/.exec(text))) {
    return { icon: <Zap size={13} />, tone: "good", title: `Triggered by ${m[1]}`, detail: m[2] };
  }

  // ------------------------------------------------------------------ enrich
  if ((m = /^enrich ([\w-]+): (.+)$/.exec(text))) {
    const ok = m[2] === "ok";
    const skipped = /skipped|not configured/.test(m[2]);
    return {
      icon: <Sparkles size={13} />,
      tone: "violet",
      title: `Enrich · ${m[1]}`,
      detail: m[2],
      faded: skipped,
      badge: ok
        ? { label: "ok", tone: "good" }
        : skipped
          ? { label: "skipped", tone: "muted" }
          : { label: "failed", tone: "warn" },
    };
  }
  if ((m = /^enriched: (.+)$/.exec(text))) {
    return { icon: <Sparkles size={13} />, tone: "violet", title: "Enriched", detail: m[1] };
  }

  // --------------------------------------------------------------- web agent
  if ((m = /^agent model: (.+)$/.exec(text))) {
    return { icon: <Bot size={13} />, tone: "violet", title: "Model", detail: m[1] };
  }
  if ((m = /^agent source: (.+)$/.exec(text))) {
    return { icon: <ExternalLink size={13} />, tone: "muted", title: "Source", href: m[1] };
  }
  if ((m = /^agent note: (.+)$/.exec(text))) {
    return { icon: <Bot size={13} />, tone: "violet", title: "Note", detail: m[1] };
  }
  if ((m = /^agent set (\w+) = (.+)$/.exec(text))) {
    return {
      icon: <Bot size={13} />,
      tone: "violet",
      title: `Agent set ${m[1]}`,
      detail: unquote(m[2]),
      badge: { label: "written", tone: "good" },
    };
  }
  if ((m = /^agent skipped (\w+), already (.+)$/.exec(text))) {
    return {
      icon: <Bot size={13} />,
      tone: "violet",
      title: `Kept ${m[1]}`,
      detail: unquote(m[2]),
      faded: true,
      badge: { label: "already set", tone: "muted" },
    };
  }
  if (/^web agent: /.test(text) || text === "agent found nothing to add") {
    return { icon: <Bot size={13} />, tone: "violet", title: text, faded: true };
  }

  // ------------------------------------------------------------ score and if
  if ((m = /^score = (\d+)$/.exec(text))) {
    const score = Number(m[1]);
    return {
      icon: <Target size={13} />,
      tone: "accent",
      title: "Score",
      detail: m[1],
      badge: { label: score >= 50 ? "high" : "low", tone: score >= 50 ? "good" : "muted" },
    };
  }
  if ((m = /^if (.+?) -> (true|false)$/.exec(text))) {
    return {
      icon: <GitBranch size={13} />,
      tone: "warn",
      title: `If ${m[1]}`,
      badge: { label: m[2] === "true" ? "True" : "False", tone: m[2] === "true" ? "good" : "muted" },
    };
  }

  // -------------------------------------------------------------- record edits
  if ((m = /^set (\w+) = (.+)$/.exec(text))) {
    return { icon: <Pencil size={13} />, tone: "accent", title: `Set ${m[1]}`, detail: unquote(m[2]) };
  }
  if ((m = /^tag "(.+?)" added$/.exec(text))) {
    return { icon: <Tag size={13} />, tone: "accent", title: "Tag added", detail: m[1] };
  }
  if ((m = /^update skipped protected field "(.+?)"$/.exec(text))) {
    return {
      icon: <Pencil size={13} />,
      tone: "muted",
      title: `Skipped ${m[1]}`,
      detail: "protected by the API",
      faded: true,
    };
  }

  // ---------------------------------------------------------------- outbound
  if ((m = /^enrolled in (\S+), first email at (.+)$/.exec(text))) {
    return {
      icon: <Mail size={13} />,
      tone: "good",
      title: "Enrolled in sequence",
      detail: `first email ${m[2]}`,
      badge: { label: "enrolled", tone: "good" },
    };
  }
  if ((m = /^not enrolled: (.+)$/.exec(text))) {
    return {
      icon: <Mail size={13} />,
      tone: "muted",
      title: "Not enrolled",
      detail: m[1],
      faded: true,
      badge: { label: "skipped", tone: "warn" },
    };
  }
  if ((m = /^webhook sent \((\d+)\)$/.exec(text))) {
    return { icon: <Globe size={13} />, tone: "muted", title: "Webhook sent", detail: m[1] };
  }

  if ((m = /^failed: ([\s\S]+)$/.exec(text))) {
    return {
      icon: <CircleAlert size={13} />,
      tone: "warn",
      title: "Failed",
      detail: m[1],
      badge: { label: "error", tone: "bad" },
    };
  }

  return { icon: <CircleDot size={13} />, tone: "muted", title: text };
}

export function parseLogLine(raw: string): LogEntry {
  const m = TIMESTAMP.exec(raw);
  return { time: m?.[1], ...classify(m?.[2] ?? raw) };
}

export function RunTimeline({ log, done }: { log: string[]; done?: boolean }) {
  if (log.length === 0) {
    return <p className="px-3 py-3 text-[13px] text-muted">No steps ran.</p>;
  }

  return (
    <ol className="flex flex-col">
      {log.map((line, i) => {
        const entry = parseLogLine(line);
        const last = i === log.length - 1;

        return (
          <li key={i} className="flex gap-3">
            {/* Rail: the chip, plus the line joining it to the next row. */}
            <div className="flex flex-col items-center">
              <span
                className={cx(
                  "mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-md",
                  TONE_CLASSES[entry.tone].chip,
                  entry.faded && "opacity-55",
                )}
              >
                {entry.icon}
              </span>
              {!last && <span className="w-px flex-1 bg-line" />}
            </div>

            <div className={cx("min-w-0 flex-1 py-1.5", !last && "border-b border-line")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={cx(
                    "text-[13px] font-medium text-ink",
                    entry.faded && "font-normal text-muted",
                  )}
                >
                  {entry.title}
                </span>
                {entry.badge && <Badge tone={entry.badge.tone}>{entry.badge.label}</Badge>}
                {entry.time && (
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-faint">
                    {entry.time}
                  </span>
                )}
              </div>

              {entry.href ? (
                <a
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 block truncate text-[12px] text-accent hover:underline"
                >
                  {entry.href}
                </a>
              ) : (
                entry.detail && (
                  <p className="mt-0.5 break-words text-[12px] leading-relaxed text-muted">
                    {entry.detail}
                  </p>
                )
              )}
            </div>
          </li>
        );
      })}

      {done && (
        <li className="flex gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-good-soft text-good">
            <CircleCheck size={13} />
          </span>
          <span className="py-1.5 text-[13px] font-medium text-ink">Finished</span>
        </li>
      )}
    </ol>
  );
}
