"use client";

import { useMemo, useRef, useState } from "react";
import { Eye, Pencil, TriangleAlert } from "lucide-react";
import { Badge, Field, Input, Select, Textarea } from "@/components/ui";
import { VariableMenu } from "./VariableMenu";
import { missingFields, previewData, renderTemplate, SAMPLE_PERSON } from "@/lib/template";
import { displayName } from "@/lib/format";
import type { EmailSettings, Person, SequenceStep } from "@/lib/types";

type Focused = "subject" | "body";

/**
 * The email step editor. Mirrors how the runner renders a send: threaded follow-ups reuse
 * "Re: <first subject>", the signature is appended when enabled, and the unsubscribe line
 * is always added.
 */
export function EmailComposer({
  index,
  step,
  firstSubject,
  email,
  signature,
  people,
  onChange,
}: {
  index: number;
  step: SequenceStep;
  /** Subject of email 1, used to show what a threaded follow-up will say. */
  firstSubject: string;
  email: EmailSettings;
  signature?: string;
  people: Person[];
  onChange: (next: SequenceStep) => void;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [previewId, setPreviewId] = useState("");
  const [focused, setFocused] = useState<Focused>("body");

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const isFollowUp = index > 0;
  const threaded = isFollowUp && email.threadEmails;

  const person = people.find((p) => p.id === previewId) ?? people[0] ?? SAMPLE_PERSON;
  const data = useMemo(() => previewData(person), [person]);

  const subjectTemplate = threaded ? `Re: ${firstSubject}` : step.subject ?? `Re: ${firstSubject}`;

  const preview = useMemo(() => {
    let text = renderTemplate(step.body, data);
    if (email.includeSignature && signature) text += `\n\n${renderTemplate(signature, data)}`;
    text += `\n\n${email.unsubscribeText}: https://your-api/unsubscribe/...`;
    return { subject: renderTemplate(subjectTemplate, data), text };
  }, [step.body, data, email.includeSignature, email.unsubscribeText, signature, subjectTemplate]);

  const missing = useMemo(
    () => missingFields(`${subjectTemplate}\n${step.body}`, data),
    [subjectTemplate, step.body, data],
  );

  const insert = (token: string) => {
    const el = focused === "subject" ? subjectRef.current : bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + token + el.value.slice(end);

    onChange(focused === "subject" ? { ...step, subject: next } : { ...step, body: next });

    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line bg-raised px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-line-strong bg-surface p-0.5">
          <ModeButton active={mode === "edit"} onClick={() => setMode("edit")} icon={<Pencil size={12} />}>
            Compose
          </ModeButton>
          <ModeButton active={mode === "preview"} onClick={() => setMode("preview")} icon={<Eye size={12} />}>
            Preview
          </ModeButton>
        </div>

        {mode === "preview" && people.length > 0 && (
          <Select
            aria-label="Preview with"
            className="h-7 w-56 text-[12px]"
            value={previewId || people[0].id}
            onChange={(e) => setPreviewId(e.target.value)}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {displayName(p)}
              </option>
            ))}
          </Select>
        )}
      </div>

      {mode === "edit" ? (
        <>
          <Field
            label="Subject"
            hint={
              threaded
                ? "Thread emails is on, so this follow-up is sent as a reply with the subject above."
                : undefined
            }
          >
            <Input
              ref={subjectRef}
              value={threaded ? subjectTemplate : step.subject ?? ""}
              disabled={threaded}
              placeholder={isFollowUp ? "Leave empty to reply in the same thread" : "Subject line"}
              onFocus={() => setFocused("subject")}
              onChange={(e) => onChange({ ...step, subject: e.target.value })}
            />
          </Field>

          <Field label="Body">
            <Textarea
              ref={bodyRef}
              rows={9}
              value={step.body}
              placeholder={"Hi {{firstName | there}},\n\n..."}
              onFocus={() => setFocused("body")}
              onChange={(e) => onChange({ ...step, body: e.target.value })}
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <VariableMenu onInsert={insert} />
            <p className="text-[11px] text-muted">
              Variables look like <code className="font-mono">{"{{firstName | there}}"}</code>
            </p>
          </div>

          {missing.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg bg-warn-soft px-2.5 py-2 text-[12px] leading-relaxed text-warn">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              <span>
                <strong>{missing.join(", ")}</strong> {missing.length === 1 ? "is" : "are"} empty for{" "}
                {displayName(person)} and {missing.length === 1 ? "has" : "have"} no fallback. The
                runner pauses that recipient instead of sending a half-written email. Add a fallback
                like <code className="font-mono">{`{{${missing[0]} | there}}`}</code>.
              </span>
            </p>
          )}
        </>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="border-b border-line px-3 py-2">
            <p className="text-[11px] text-faint">Subject</p>
            <p className="text-[13px] font-medium text-ink">{preview.subject}</p>
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap px-3 py-2.5 font-sans text-[13px] leading-relaxed text-ink">
            {preview.text}
          </pre>
          {people.length === 0 && (
            <p className="border-t border-line px-3 py-2 text-[12px] text-muted">
              <Badge tone="muted">Sample data</Badge> Add people to preview with a real record.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-6 items-center gap-1.5 rounded px-2 text-[12px] font-medium transition-colors ${
        active ? "bg-ink text-white" : "text-muted hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
