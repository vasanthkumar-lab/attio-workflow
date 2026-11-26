"use client";

import { CornerUpLeft } from "lucide-react";
import {
  Badge, Field, Input, SectionTitle, Select, Textarea, Toggle, ToggleRow,
} from "@/components/ui";
import { ConditionBuilder } from "@/components/ConditionBuilder";
import { COMMON_TIMEZONES, UNSUBSCRIBE_PHRASES } from "@/lib/catalog";
import { formatHour } from "@/lib/format";
import type { Condition, SequenceInput } from "@/lib/types";

const HOURS = Array.from({ length: 25 }, (_, h) => h);

/** The Settings tab of the sequence editor: Sender settings, Delivery, Email, Exit criteria. */
export function SequenceSettings({
  draft,
  onChange,
}: {
  draft: SequenceInput;
  onChange: (next: SequenceInput) => void;
}) {
  const set = <K extends keyof SequenceInput>(key: K, value: SequenceInput[K]) =>
    onChange({ ...draft, [key]: value });

  const timezones = COMMON_TIMEZONES.includes(draft.delivery.timezone)
    ? COMMON_TIMEZONES
    : [draft.delivery.timezone, ...COMMON_TIMEZONES];

  const phrases =
    draft.email.unsubscribeText && !UNSUBSCRIBE_PHRASES.includes(draft.email.unsubscribeText)
      ? [draft.email.unsubscribeText, ...UNSUBSCRIBE_PHRASES]
      : UNSUBSCRIBE_PHRASES;

  return (
    <div className="flex flex-col">
      <Section title="Sender settings">
        <Field
          label="Mailbox"
          hint="Used when the person has no owner. A person's Owner always sends their own emails."
        >
          <Input
            type="email"
            value={draft.defaultSender}
            placeholder="sales@yourcompany.com"
            onChange={(e) => set("defaultSender", e.target.value)}
          />
        </Field>

        <Field label="Signature" hint="Appended when Include sender signature is on. Variables work here too.">
          <Textarea
            rows={3}
            value={draft.signature ?? ""}
            placeholder={"Best,\nPriya"}
            onChange={(e) => set("signature", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Delivery">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sending window starts">
            <Select
              value={draft.delivery.startHour}
              onChange={(e) =>
                set("delivery", { ...draft.delivery, startHour: Number(e.target.value) })
              }
            >
              {HOURS.slice(0, 24).map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Ends">
            <Select
              value={draft.delivery.endHour}
              onChange={(e) =>
                set("delivery", { ...draft.delivery, endHour: Number(e.target.value) })
              }
            >
              {HOURS.slice(1).map((h) => (
                <option key={h} value={h}>
                  {h === 24 ? "Midnight" : formatHour(h)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {draft.delivery.startHour >= draft.delivery.endHour && (
          <p className="text-[12px] text-bad">The window has to start before it ends.</p>
        )}

        <Field label="Time zone">
          <Select
            value={draft.delivery.timezone}
            onChange={(e) => set("delivery", { ...draft.delivery, timezone: e.target.value })}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </Field>

        <ToggleRow
          label="Business days only"
          description="Nothing sends at the weekend, and waits skip weekends too."
          checked={draft.delivery.businessDaysOnly}
          onChange={(businessDaysOnly) => set("delivery", { ...draft.delivery, businessDaysOnly })}
        />
      </Section>

      <Section title="Email">
        <Field label="Unsubscribe link" hint="Every email ends with this phrase and an opt-out link.">
          <Select
            value={draft.email.unsubscribeText}
            onChange={(e) => set("email", { ...draft.email, unsubscribeText: e.target.value })}
          >
            {phrases.map((phrase) => (
              <option key={phrase} value={phrase}>
                {phrase}
              </option>
            ))}
          </Select>
        </Field>

        <ToggleRow
          label="Thread emails"
          description="Follow-ups arrive as replies on the first email, with the subject Re: ..."
          checked={draft.email.threadEmails}
          onChange={(threadEmails) => set("email", { ...draft.email, threadEmails })}
        />

        <ToggleRow
          label="Include sender signature"
          description="Adds the signature above to the end of every email."
          checked={draft.email.includeSignature}
          onChange={(includeSignature) => set("email", { ...draft.email, includeSignature })}
        />
      </Section>

      <Section title="Exit criteria" last>
        <p className="text-[12px] leading-relaxed text-muted">
          Recipients stop receiving emails as soon as one of these is true. Checked right before
          every send, so a record updated in the meantime still counts.
        </p>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-raised px-3 py-2">
          <span className="flex items-center gap-2">
            <CornerUpLeft size={14} className="text-good" />
            <span className="text-[13px] font-medium text-ink">Reply received</span>
            <Badge tone="good">Recommended</Badge>
          </span>
          <Toggle
            label="Exit on reply"
            checked={draft.exitCriteria.onReply}
            onChange={(onReply) => set("exitCriteria", { ...draft.exitCriteria, onReply })}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[12px] font-medium text-ink">When the record matches</p>
          <ConditionBuilder
            addLabel="Add exit condition"
            value={
              draft.exitCriteria.when.length === 1
                ? draft.exitCriteria.when[0]
                : draft.exitCriteria.when.length > 1
                  ? { any: draft.exitCriteria.when }
                  : undefined
            }
            onChange={(next: Condition | undefined) =>
              set("exitCriteria", {
                ...draft.exitCriteria,
                when: next ? ("any" in next ? next.any : [next]) : [],
              })
            }
          />
          <p className="mt-1 text-[11px] text-muted">
            A common one: Stage is any of meeting_booked, customer.
          </p>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={last ? "px-4 py-4" : "border-b border-line px-4 py-4"}>
      <SectionTitle>{title}</SectionTitle>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}
