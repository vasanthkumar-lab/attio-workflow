"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CornerUpLeft, Mail, MailOpen } from "lucide-react";
import { Badge } from "@/components/ui";
import { cx, formatDateTime } from "@/lib/format";
import type { Enrollment } from "@/lib/types";

/**
 * One conversation: what we sent and what came back, in the order it happened.
 *
 * The two sides are stored separately - outbound on `sent`, inbound on `received` -
 * so this merges them on time rather than trusting either list's order. A reply
 * logged after the fact can carry an earlier timestamp than the email that followed
 * it, and sorting is what keeps that from reading as nonsense.
 */

type Message =
  | { kind: "sent"; at: string; subject: string; body?: string; step: number; id: string }
  | { kind: "received"; at: string; subject: string; body: string; from: string; id: string };

function merge(e: Enrollment): Message[] {
  const out: Message[] = e.sent.map((s) => ({
    kind: "sent",
    at: s.sentAt,
    subject: s.subject,
    body: s.body,
    step: s.step,
    id: s.messageId,
  }));
  for (const r of e.received ?? []) {
    out.push({ kind: "received", at: r.receivedAt, subject: r.subject, body: r.body, from: r.from, id: r.messageId });
  }
  return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function EmailThread({ enrollment: e }: { enrollment: Enrollment }) {
  const messages = merge(e);

  if (messages.length === 0) {
    return <p className="text-[13px] text-muted">Nothing sent yet.</p>;
  }

  const replies = messages.filter((m) => m.kind === "received").length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Conversation</p>
        <Badge tone="muted">
          {messages.length - replies} sent
          {replies > 0 && ` · ${replies} received`}
        </Badge>
        {/* The flag can be set without a message ever being logged, and saying so is
            more honest than a thread that looks like the reply went missing. */}
        {e.replied && replies === 0 && (
          <Badge tone="warn">Marked as replied, message not logged</Badge>
        )}
      </div>

      <ol className="flex flex-col gap-1.5">
        {messages.map((m, i) => (
          <MessageRow key={`${m.id}-${i}`} message={m} sender={e.sender} />
        ))}
      </ol>
    </div>
  );
}

function MessageRow({ message: m, sender }: { message: Message; sender: string }) {
  const inbound = m.kind === "received";
  // A sent email from before bodies were stored has nothing to open.
  const hasBody = Boolean(m.body?.trim());
  const [open, setOpen] = useState(inbound);

  const who = inbound ? m.from : sender;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <li
      className={cx(
        "rounded-lg border",
        inbound ? "border-accent/30 bg-accent/5" : "border-line bg-surface",
      )}
    >
      <button
        type="button"
        onClick={() => hasBody && setOpen(!open)}
        disabled={!hasBody}
        className={cx(
          "flex w-full items-center gap-2 px-2.5 py-1.5 text-left",
          hasBody && "cursor-pointer",
        )}
      >
        {hasBody ? (
          <Chevron className="size-3.5 shrink-0 text-faint" />
        ) : (
          <span className="size-3.5 shrink-0" />
        )}

        {inbound ? (
          <CornerUpLeft className="size-3.5 shrink-0 text-accent" />
        ) : (
          <Mail className="size-3.5 shrink-0 text-faint" />
        )}

        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={cx("truncate text-[13px]", inbound ? "font-medium text-ink" : "text-ink")}>
            {m.subject}
          </span>
          {inbound ? (
            <Badge tone="accent">Reply</Badge>
          ) : (
            <Badge tone="muted">Step {m.step + 1}</Badge>
          )}
        </span>

        <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] text-faint">
          {formatDateTime(m.at)}
        </span>
      </button>

      {open && hasBody && (
        <div className="border-t border-line/70 px-2.5 py-2 pl-[2.1rem]">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-faint">
            <MailOpen className="size-3" />
            {inbound ? "From" : "To"} {who}
          </p>
          {/* Plain text, and it stays plain: whitespace-pre-wrap renders the newlines
              without interpreting anything in the message as markup. */}
          <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted">
            {m.body}
          </p>
        </div>
      )}
    </li>
  );
}
