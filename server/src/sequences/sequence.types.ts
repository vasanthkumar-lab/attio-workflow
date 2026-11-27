import { Condition } from '../common/conditions';

/** Mirrors the Attio sequence editor: steps, delivery, email and exit-criteria settings. */
export interface SequenceStep {
  /** Business days to wait before this step. Step 1 usually 0 = "start immediately after enrollment". */
  waitBusinessDays: number;
  /** Supports {{field}} and {{field | fallback}}. Ignored for follow-ups when threadEmails is on. */
  subject?: string;
  body: string;
}

export interface DeliverySettings {
  timezone: string; // e.g. "Asia/Kolkata"
  startHour: number; // 9
  endHour: number; // 17
  businessDaysOnly: boolean;
}

export interface EmailSettings {
  unsubscribeText: string;
  threadEmails: boolean;
  includeSignature: boolean;
}

export interface ExitCriteria {
  onReply: boolean;
  /** Exit when ANY of these match the person, e.g. stage = meeting_booked */
  when: Condition[];
}

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  steps: SequenceStep[];
  delivery: DeliverySettings;
  email: EmailSettings;
  exitCriteria: ExitCriteria;
  defaultSender: string; // used when the person has no owner
  signature?: string;
  createdAt: string;
  updatedAt: string;
}

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'exited' | 'unsubscribed' | 'failed';

export interface SentEmail {
  step: number;
  subject: string;
  messageId: string;
  sentAt: string;
  /** The rendered body. Kept so the thread shows what was actually sent, after
   *  templating - not the template, which is what the step holds. */
  body?: string;
}

/** What an inbox sync, or a person pasting a reply in, hands us. */
export interface ReplyInput {
  body?: string;
  from?: string;
  subject?: string;
  messageId?: string;
  inReplyTo?: string;
  receivedAt?: string;
}

/** A reply from the lead. One of these is what turns `replied` from a flag into a thing you can read. */
export interface ReceivedEmail {
  messageId: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  /** Which of our messages it answers, when the source tells us. */
  inReplyTo?: string;
}

export interface Enrollment {
  id: string;
  sequenceId: string;
  personId: string;
  sender: string;
  status: EnrollmentStatus;
  currentStep: number;
  nextSendAt: string;
  exitReason?: string;
  replied: boolean;
  threadMessageId?: string;
  /** Gmail's handle on the conversation, when the sender was a connected mailbox. */
  providerThreadId?: string;
  firstSubject?: string;
  sent: SentEmail[];
  /** Inbound mail on this conversation, oldest first. */
  received: ReceivedEmail[];
  failures: number;
  lastError?: string;
  enrolledBy: string;
  enrolledAt: string;
  updatedAt: string;
}