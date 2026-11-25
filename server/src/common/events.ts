export const Events = {
  PersonCreated: 'person.created',
  PersonUpdated: 'person.updated',
  EnrollmentReplied: 'enrollment.replied',
  EnrollmentCompleted: 'enrollment.completed',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

export interface CrmEvent {
  personId: string;
  changedFields?: string[]; // for person.updated
  enrollmentId?: string;
  sequenceId?: string;
}