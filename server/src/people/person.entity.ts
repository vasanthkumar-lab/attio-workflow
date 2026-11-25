export interface Person {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  title?: string;
  company?: string;
  domain?: string;
  description?: string;
  industry?: string;
  companySize?: number;
  location?: string;
  linkedinUrl?: string;
  score?: number;
  segment?: string;
  owner?: string; // email of the rep who owns this person (used as sender)
  stage: string; // lead, contacted, meeting_booked, customer, ...
  tags: string[];
  enrichedAt?: string;
  createdAt: string;
  updatedAt: string;
}