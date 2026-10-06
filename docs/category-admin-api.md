# Admin category API

The `admin.category` RPC namespace owns these cookie-protected REST endpoints.
Every handler requires an admin session: anonymous callers receive 401 and
non-admin users receive 403.

| RPC       | REST                            | Input                                           | Output                                |
| --------- | ------------------------------- | ----------------------------------------------- | ------------------------------------- |
| `list`    | `GET /admin/categories`         | `{}`                                            | `{ categories: AdminCategoryNode[] }` |
| `getById` | `GET /admin/categories/{id}`    | `{ id }`                                        | `{ category, ancestors, children }`   |
| `create`  | `POST /admin/categories`        | `{ name, slug, description, parentId }`         | `AdminCategoryNode` (201)             |
| `update`  | `PATCH /admin/categories/{id}`  | `{ id, name?, slug?, description?, parentId? }` | `AdminCategoryNode`                   |
| `remove`  | `DELETE /admin/categories/{id}` | `{ id }`                                        | `{ id }`                              |

`AdminCategoryNode` extends the public `CategoryNode` with `directProjectCount`:
all-status assignments to that category itself. `projectCount` retains the
public meaning: distinct published projects in the entire subtree. Admin lists
include empty categories, ancestors are root-first and exclude the active node,
and children include every immediate child. List and child ordering is by name,
then slug and ID. Names/descriptions are trimmed; slugs use the existing shared
normalization. Creation requires a nonempty description and explicit nullable
`parentId`. An omitted update field is preserved, including legacy null
descriptions; `parentId: null` makes a root.

## Integrity and concurrency

The hierarchy has at most three levels, one parent per category, and no cycles.
A category with any direct assignments cannot gain a child. Only empty leaves
can be deleted; children and assignments in any project status produce an
actionable 409. Invalid parents, cycles, and excess depth produce 400; missing
category IDs produce 404. Project creation and explicit assignment updates
accept 1–3 distinct leaf categories at any depth, including legacy root leaves.
Slugs are trimmed and deduplicated before checking the assignment count. Omitted
`categorySlugs` preserves assignments, and ancestors are never added implicitly.

Hierarchy create/update/remove and project assignment writes share
`pg_advisory_xact_lock(hashtext('altstack.category-integrity'),
hashtext(current_schema()))`. The transaction acquires this lock before its
authoritative validation and holds it until commit/rollback. Project removal
uses the same lock for its cascading assignment deletion. Separate test schemas
use independent keys; all production writers using the same schema serialize.

Project preflight checks remain before external image work. After image work,
assignment validation runs again inside the locked transaction. Failure rolls
back project, assignment, and audit writes and cleans newly promoted/copied
objects. Consumed temporary uploads retain the `UPLOAD_CONSUMED` contract;
without consumed uploads, an invalid assignment returns `BAD_REQUEST`. Existing
slug/repository conflict codes and source-image cleanup behavior are retained.

## Path ownership and compatibility

Slug/parent changes calculate and check the whole affected subtree before any
write. Old canonical paths are registered when absent, and new canonical paths
are reserved without replacing history. Any path owned by a different category,
in the current hierarchy or historical mappings, causes an atomic 409. Reverting
to a path owned by the same category is allowed. All aliases point directly to
stable category IDs, so repeated renames and moves resolve to the newest path
without alias chains. IDs and project assignments survive moves/renames.
Deletion cascades only that category's paths, making all its URLs return 404.

Public `getByPath` retains current-hierarchy precedence over historical fallback
and returns the current canonical path and ancestry; it does not issue an HTTP
redirect. Public visibility and counts remain published-only under admin
sessions. The legacy `admin.project.listCategories` RPC retains its exact
`{ categories: [{ slug, name }] }` shape, all-category visibility, and original
name ordering. Its REST mapping is removed so `admin.category.list` owns the only
`GET /admin/categories` operation. No database schema or frontend changes are
required for this API layer.
