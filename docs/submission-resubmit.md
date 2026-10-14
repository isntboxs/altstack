# Correct and resubmit rejected intake

The original submitter can use **Edit & Resubmit** on rejected rows in the private
`/submission` table. The modal loads the current name, repository URL, optional
website and private review feedback. Cancel and success stay on the same local
page, preserving search and pagination. Existing sign-in guards and sanitized
return navigation apply. Draft, published and removed rows have no correction
action. Admins using this flow have the same submitter restrictions.

## Contract and authorization

- `submission.getById`: `QUERY /submissions/{id}`, input `{ params: { id } }`.
  Returns only rejected intake, current feedback and an opaque `revision` token.
- `submission.resubmit`: `POST /submissions/{id}/resubmit`, input
  `{ params: { id }, body: { name, repositoryUrl, websiteUrl?, revision } }`.
  The body rejects extra fields. The response is `{ id, status: 'draft' }`.
- Both queries and writes constrain `submitterId` to the authenticated session.
  `401` means no session; missing, deleted, foreign or unassigned records return
  the same `404`, concealing their existence and feedback. Admin status does not
  grant a bypass. Existing admin moderation APIs retain their separate `403`
  role boundary. Non-rejected or stale records return `409`.
- A client revision is required from the private read. PostgreSQL `xmin` detects
  changes even when timestamps or status are unchanged. Reopen the form after a
  stale-save conflict to load the latest feedback; saved corrections are never
  automatically retried.

## Persistence and repository policy

GitHub public existence, canonical input/aliases, resolved URL and immutable
repository ID are checked before writes. External fetching holds no DB locks.
The transaction acquires the same account-capacity lock used by create, locks
the project, rechecks owner/rejected state/revision/capacity, and serializes
intake writes by repository ID before rechecking conflicts. Existing canonical
URL/owner-repo constraints catch competing writes. Create still returns `409`
for rejected duplicates; correction uses the dedicated resubmit operation.

The existing project ID, **slug**, original submitter and original submission
date remain unchanged, even when name or repository changes. Enriched copy,
Markdown, logos, screenshots and category assignments remain for admin review;
resubmit never promotes, copies or deletes media. This is intake correction,
not ownership or published maintainer editing.

Basic verification uses the same snapshot policy as admin repository updates:
a matching GitHub repository ID retains stored statistics, metadata and observed
history across a rename/transfer while updating the canonical owner/repository.
A different or unknown previous ID clears old history and extended metadata,
and stores fresh basic stars/forks and identity. Legacy missing repository rows
are recreated. No history point or synthetic backfill is inserted; the normal
statistics refresh records the next actual observation.

The transaction changes `rejected` to `draft` and clears the current rejection
reason. One `project_status_changed` event records the submitter actor, transition,
`source: 'submitter_resubmit'`, prior feedback and before/after intake. Existing
submission and rejection audit events remain. Any transactional failure rolls
back intake, state, repository data, history cleanup and the audit together.

## Quota and correction behavior

Create and resubmit share **five validated attempts per ten minutes per account**
using the existing Upstash limiter/key namespace, including admin accounts. Valid
requests consume quota even if owner/state/revision, conflict, capacity, GitHub
or transaction checks fail later. Unauthenticated and invalid inputs do not
consume quota; private reads are unrestricted. Both mutations serialize the
ten-open-draft check, including concurrent attempts competing for the final slot.
Redis errors/deadlines fail closed before project/GitHub work; no new Redis
service, queue or local fallback is introduced.

RPC and REST preserve typed quota `429` data and rate-limit/Retry-After headers.
GitHub and capacity `429` responses have no quota countdown payload. The shared
form preserves corrections and feedback on failures, renders inline validation,
keeps inputs editable during quota cooldown, and requires an explicit retry.
Pending saves disable input and closing the modal. Success invalidates private
list queries and the active route loader, displaying **Awaiting review**.

## Verification and rollout

Schema, private API, RPC/REST codecs, OpenAPI golden mapping, quota and UI tests
cover authorization, allowed fields, provenance, old audit feedback, aliases and
identity/history, failed services, rollback, stale/concurrent reviews, shared
capacity and identity races, input correction, cooldown and navigation.
Database verification must run through `test:scoped`; each fixture owns and
cleans a disposable schema in `altstack_development`. GitHub/Redis/storage calls
are mocked; the existing real Upstash integration remains opt-in.

Record the final command totals in [R5b](roadmap.md#r5b--correct-and-resubmit).
Real OAuth, Redis, keyboard/mobile and reject → correct → re-review staging
smoke remain release gates. No schema migration or production rollout is
performed by this implementation.
