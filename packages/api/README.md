# Public category hierarchy (PR2)

The `category` router and contract are exported at
`@altstack/api/routers/category` and `@altstack/api/contracts/category`.
Shared Zod schemas and the `CategoryNode` type are available from
`@altstack/shared/schemas/category`, the schemas barrel, and the package root.

| RPC                            | REST under `/api/reference`        | Output                              |
| ------------------------------ | ---------------------------------- | ----------------------------------- |
| `category.list({})`            | `GET /categories`                  | `{ categories: CategoryNode[] }`    |
| `category.getByPath({ path })` | `GET /categories/by-path?path=...` | `{ category, ancestors, children }` |

`CategoryNode` contains `id`, nullable `parentId`, `slug`, `name`, nullable legacy
`description`, current relative `path`, `depth` (1–3), `isLeaf`, and
`projectCount`. Counts represent distinct published projects throughout each
subtree. The flat list includes ancestors with published descendants, excludes
empty subtrees, and sorts by name, then slug and ID with PostgreSQL C collation.

Path detail allows existing empty categories. Ancestors are root-first and exclude
the active category. Children are immediate children with a positive published
subtree count. `isLeaf` uses the actual child rows even when no child is visible.
Unknown or mismatched paths return `NOT_FOUND`; missing/empty input is invalid.
Historical path mappings resolve directly to stable category IDs and return the
current canonical path and ancestry with HTTP 200. Website redirects belong to
PR5.

`queries/category.ts` centralizes a recursive PostgreSQL CTE for current paths,
ancestry, and descendant membership. It batches distinct published subtree counts
with ancestry expansion. List and category detail each use one SQL query; project
detail adds one query for its direct category assignments. Rooted traversal is
bounded to three levels and checks visited IDs. Cyclic, orphaned, and over-depth
rows are omitted from representable public nodes; reads do not modify them.

`project.search({ category: slug })` uses the same subtree `EXISTS` predicate for
data and count, so sibling assignments never duplicate a project. Existing text
search, sort whitelists, ID tie-breakers, pagination, and the limit of 50 remain.
Unknown slugs return empty pages. `project.getBySlug` now requires
`categoryDetails: CategoryNode[]` containing only direct assignments, including
an empty array when unassigned. Search and admin `categories: string[]` outputs
retain their shape.

`project.listCategories` remains an RPC compatibility wrapper with its existing
`{ categories: [{ slug, name }] }` output, now including visible ancestors. It has
no REST mapping. Both the OpenAPI matcher and generated reference include only
explicitly mapped procedures, preventing fallback exposure of the legacy RPC.
All public operations explicitly declare `security: []`; admin operations retain
the document-level Better Auth cookie requirement and existing authorization.
Public queries always restrict project visibility to published status, including
for admin sessions.

## Verification

Use the authorized cloud development wrapper; do not use the network project seed.
It holds the existing advisory lock throughout reset, verification, and restoration.
Test pools enable TCP keepalive so the otherwise idle lock session remains reachable
during long cloud checks and builds.
The hierarchy API tests use migrated random test schemas and synthetic Zed fixtures;
teardown disposes fixture projects and drops each schema. Final restoration leaves
migrations and taxonomy only.

```sh
vp install
vp check
vp run --filter @altstack/db test:isolated -- vp run --filter @altstack/api test tests/category-public.test.ts tests/project-search.test.ts
vp run --filter @altstack/db test:isolated -- vp test
vp run --filter @altstack/db test:isolated -- vp run ready
```

The new tests cover published/draft aggregation and visibility, direct badges,
empty categories and hidden children, root-first ancestry, historical rename and
reparent resolution, malformed hierarchy termination, stable sorts and FTS,
pagination, compatibility outputs, query batching, REST/RPC responses, and the
generated OpenAPI security and path declarations.

## Next: PR3 admin API

Category CRUD, transactional path history creation, hierarchy mutation locking,
cycle/depth checks, and enforcement of 1–3 direct leaf assignments belong to PR3.
Admin and public frontend changes remain PR4 and PR5. This PR adds no mutations,
UI changes, website redirects, or deployment behavior.
