# Attio CRM UI — Sequences & Workflows

A Next.js front end for the NestJS CRM API in [`../server`](../server). It covers the two
automation features that API exposes, modelled on Attio's own screens:

- **Workflows** — a visual builder. One trigger, then blocks that run top to bottom, with
  `If` blocks splitting the run into True and False paths.
- **Sequences** — a sequence editor with the email steps on a canvas, the waits between
  them, the settings panel (sender, delivery, email, exit criteria) and a recipients list.

## Running it

The API runs on port 3000, the UI on 3001. From the repo root:

```bash
npm install          # the root runner
npm run setup        # installs server/ and web/

npm run demo         # both, with FAST_DEMO: a two-step sequence finishes in seconds
# or
npm run dev          # both, with real timings: business days and a 9-5 sending window
```

Open <http://localhost:3001>. Nothing else to install - no database, no Docker. The API
stores everything in memory and `SEED=1` creates the sample sequence and workflows on
boot, so the app has data the moment it starts.

To run them separately instead:

```bash
cd server && npm run start:dev    # or start:demo
cd web    && npm run dev
```

### If startup fails

**`EADDRINUSE: address already in use :::3001`** (or `:::3000`) - an earlier run is still
holding the port. `concurrently` stops the other process when one fails, so both stop.
Free the port and start again:

```powershell
# PowerShell
Get-NetTCPConnection -LocalPort 3000,3001 -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

```bash
# macOS / Linux
lsof -ti :3000,:3001 | xargs kill -9
```

**`Failed to proxy http://localhost:3000/... ECONNREFUSED`** in the first second or two is
expected. Next is ready in about a second while Nest is still compiling; the UI retries
those reads until the API answers.

### How the UI reaches the API

The browser calls `/api/*` on its own origin and `next.config.ts` rewrites that to the
NestJS server, so there is no CORS hop in development. Point it somewhere else with:

```bash
API_ORIGIN=http://localhost:4000 npm run dev
```

To skip the proxy and call the API directly, set `NEXT_PUBLIC_API_URL` instead — the
server sends permissive CORS headers, narrowed with `CORS_ORIGIN` when you need it.

### Email

Email goes through Resend when `RESEND_API_KEY` is set, SMTP when `SMTP_HOST` is set, and
otherwise prints to the server console — which is what you want while building. Add your
key to `server/.env`:

```
RESEND_API_KEY=re_...
RESEND_FROM=you@your-verified-domain.com
```

`RESEND_FROM` has to be an address Resend has verified. The sequence's own sender (the
person's **Owner**, or the sequence's **Mailbox**) is used as `Reply-To`, so replies still
land with the right rep.

## What's on each screen

| Route | What it does |
| --- | --- |
| `/` | Counts, the sequence list, and the most recent workflow runs. |
| `/people` | The records table. Search, create, multi-select and **Enroll in sequence**. |
| `/people/[id]` | One record: attributes (editable), its sequence enrollments, its workflow runs, **Run workflow**. |
| `/sequences` | All sequences, with recipient counts. Duplicate and delete. |
| `/sequences/[id]` | The editor: canvas, composer, Settings and Recipients panels. |
| `/workflows` | All workflows plus recent runs. |
| `/workflows/[id]` | The builder canvas, the block inspector, and the run history. |

### The sequence editor

The canvas shows enrollment, each email, the wait before it, and the exit rules. Clicking
an email opens its composer in place.

- **Variables** — the `{x}` menu inserts `{{firstName}}`, and lets you set a fallback first
  so it comes out as `{{firstName | there}}`. This matters: when a variable is empty and
  has no fallback, the runner **pauses that recipient** rather than send `Hi ,`. The
  composer warns you about that before you publish.
- **Preview** — renders the email against a real person, signature and unsubscribe line
  included, exactly the way the runner builds it.
- **Thread emails** — with it on, follow-ups reuse `Re: <first subject>` and their subject
  box is read-only, as in Attio.
- **Publish changes / Discard changes** — edits stay local until you publish. The Enable
  toggle is separate and takes effect immediately.

### The workflow builder

Pick the trigger block to choose the event (`Record created`, `Record updated`,
`Reply received`, `Sequence completed`, `Manual run`), narrow `Record updated` to
particular attributes, and add a filter so the workflow only runs for matching people.

**Add block** offers what the API can run:

| Category | Block | API step |
| --- | --- | --- |
| Data | Enrich record | `enrich` |
| Data | Score record | `score` |
| Condition | If | `if` |
| Record | Update record | `update` |
| Record | Add tag | `addTag` |
| Sequence | Enroll in sequence | `enroll` |
| Utilities | Send HTTP request | `webhook` |

**Trigger workflow** runs the published version against one person even while the workflow
is disabled, and shows the run log straight away — the quickest way to test a change.

## Try the whole loop

1. **People → New person**, with a company and a job title. The `Speed to lead` workflow
   fires on create.
2. Open the record. It has been enriched, scored, segmented, and enrolled in the sequence.
3. **Sequences → Two-Step Email Follow-Up for People → Recipients**. The first email is
   queued, or already sent if you started the API with `start:demo`. Sent emails show in
   the server console.
4. Open a recipient's menu and choose **Mark as replied**. They exit the sequence, which
   fires the `Reply received` workflow, which sets the stage to Contacted and tags them.

That is the whole point of the two features together: the workflow decides, the sequence
follows up, and a reply ends it.

## Notes and limits

- The API keeps everything in memory, so restarting it clears people, sequences,
  workflows and run history. `SEED=1` puts the samples back on the next boot.
- The **Mark as replied** action stands in for an inbox sync. In production you would call
  `POST /enrollments/:id/reply` from a Gmail push or Microsoft Graph subscription.
- There is no sign-in. Every screen acts as a single implied user.
- Attio's hosted features that have no equivalent in this API — AI agents, delegated
  sending, call recordings, list and task blocks — are not in the builder, because the
  block library only offers steps the server can actually run.

## Layout

```
app/           routes, one folder per screen
components/    ui/ primitives, then people/, sequences/, workflows/
lib/
  api.ts       typed client for every endpoint
  types.ts     mirrors server/src types
  catalog.ts   attributes, operators, triggers, block definitions
  drafts.ts    blank records plus client-side copies of the server's validation
  template.ts  mirrors the server's {{variable}} renderer, for previews
  workflow-tree.ts  get/insert/move/remove on the nested step tree
```
