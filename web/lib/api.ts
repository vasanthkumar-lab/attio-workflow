import type {
  Enrollment, EnrollmentStatus, EnrollResult, Person, PersonInput,
  ReplyInput, Sequence, SequenceInput, SequenceStats, Workflow, WorkflowInput, WorkflowRun,
} from "./types";

/**
 * By default the browser calls /api/* on this origin and next.config.ts proxies it to the
 * NestJS server. Set NEXT_PUBLIC_API_URL to call the API directly instead.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  const method = init?.method ?? "GET";
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    // The UI boots faster than Nest compiles, so a read right after `npm run dev` can land
    // before the API is listening. Retry reads only - replaying a POST could double-enroll.
    if (method === "GET" && attempt < 4) {
      await sleep(500 * 2 ** attempt);
      return request<T>(path, init, attempt + 1);
    }
    throw new ApiError(0, "Can't reach the API. Is the NestJS server running on port 3000?");
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    // Nest replies with { statusCode, message, error }; message may be a string or an array.
    const raw = (body as { message?: string | string[] })?.message;
    const message = Array.isArray(raw) ? raw.join(", ") : raw ?? res.statusText;
    throw new ApiError(res.status, message || `Request failed (${res.status})`);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const get = <T>(p: string) => request<T>(p);
const post = <T>(p: string, body?: unknown) =>
  request<T>(p, { method: "POST", body: JSON.stringify(body ?? {}) });
const put = <T>(p: string, body: unknown) =>
  request<T>(p, { method: "PUT", body: JSON.stringify(body) });
const patch = <T>(p: string, body: unknown) =>
  request<T>(p, { method: "PATCH", body: JSON.stringify(body) });
const del = <T>(p: string) => request<T>(p, { method: "DELETE" });

export const api = {
  people: {
    list: () => get<Person[]>("/people"),
    get: (id: string) => get<Person>(`/people/${id}`),
    create: (input: PersonInput) => post<Person>("/people", input),
    update: (id: string, input: Partial<PersonInput>) => patch<Person>(`/people/${id}`, input),
  },

  sequences: {
    list: () => get<Sequence[]>("/sequences"),
    get: (id: string) => get<Sequence>(`/sequences/${id}`),
    create: (input: SequenceInput) => post<Sequence>("/sequences", input),
    update: (id: string, input: SequenceInput) => put<Sequence>(`/sequences/${id}`, input),
    setEnabled: (id: string, enabled: boolean) =>
      patch<Sequence>(`/sequences/${id}/enabled`, { enabled }),
    remove: (id: string) => del<{ id: string; deleted: boolean }>(`/sequences/${id}`),
    enroll: (id: string, personIds: string[]) =>
      post<EnrollResult[]>(`/sequences/${id}/enroll`, { personIds }),
    enrollments: (id: string, status?: EnrollmentStatus) =>
      get<Enrollment[]>(`/sequences/${id}/enrollments${status ? `?status=${status}` : ""}`),
    stats: (id: string) => get<SequenceStats>(`/sequences/${id}/stats`),
  },

  enrollments: {
    list: (filter?: { status?: EnrollmentStatus; personId?: string }) => {
      const q = new URLSearchParams();
      if (filter?.status) q.set("status", filter.status);
      if (filter?.personId) q.set("personId", filter.personId);
      const qs = q.toString();
      return get<Enrollment[]>(`/enrollments${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => get<Enrollment>(`/enrollments/${id}`),
    reply: (id: string, reply?: ReplyInput) => post<Enrollment>(`/enrollments/${id}/reply`, reply ?? {}),
    pause: (id: string) => post<Enrollment>(`/enrollments/${id}/pause`),
    resume: (id: string) => post<Enrollment>(`/enrollments/${id}/resume`),
    remove: (id: string) => post<Enrollment>(`/enrollments/${id}/remove`),
  },

  workflows: {
    list: () => get<Workflow[]>("/workflows"),
    get: (id: string) => get<Workflow>(`/workflows/${id}`),
    create: (input: WorkflowInput) => post<Workflow>("/workflows", input),
    update: (id: string, input: WorkflowInput) => put<Workflow>(`/workflows/${id}`, input),
    setEnabled: (id: string, enabled: boolean) =>
      patch<Workflow>(`/workflows/${id}/enabled`, { enabled }),
    remove: (id: string) => del<{ id: string; deleted: boolean }>(`/workflows/${id}`),
    runNow: (id: string, personId: string) =>
      post<WorkflowRun | { skipped: string }>(`/workflows/${id}/run`, { personId }),
    runs: (filter?: { workflowId?: string; personId?: string }) => {
      const q = new URLSearchParams();
      if (filter?.workflowId) q.set("workflowId", filter.workflowId);
      if (filter?.personId) q.set("personId", filter.personId);
      const qs = q.toString();
      return get<WorkflowRun[]>(`/workflows/runs${qs ? `?${qs}` : ""}`);
    },
    run: (runId: string) => get<WorkflowRun>(`/workflows/runs/${runId}`),
  },
};
