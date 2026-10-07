# Public category hierarchy (PR2)

The `category` router and contract are exported at
`@altstack/api/routers/category` and `@altstack/api/contracts/category`.
Shared Zod schemas and the `CategoryNode` type are available from
`@altstack/shared/schemas/category`, the schemas barrel, and the package root.

| RPC                                       | REST under `/api/reference`          | Output                              |
| ----------------------------------------- | ------------------------------------ | ----------------------------------- |
| `category.list({})`                       | `QUERY /categories`                  | `{ categories: CategoryNode[] }`    |
| `category.getByPath({ query: { path } })` | `QUERY /categories/by-path?path=...` | `{ category, ancestors, children }` |

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

`project.search({ query: { category: slug } })` uses the same subtree `EXISTS` predicate for
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

## Explicit OpenAPI input mapping

All 23 mapped operations use `inputStructure: 'detailed'` and
`outputStructure: 'compact'`. The inventory below was taken from development at
`987f9bd82e51513e9755c2bf56774f5b62306061` before migration; the table reflects
current methods. All 11 read operations now use `QUERY` in place of `GET`. REST
URLs, URL query encoding, operation IDs, success statuses, response bodies, errors,
and authentication stay unchanged. RPC callers now supply only the sections listed
below.

| Method | REST path                          | Operation ID              | RPC input sections      | Success |
| ------ | ---------------------------------- | ------------------------- | ----------------------- | ------- |
| QUERY  | `/admin/categories`                | `listAdminCategories`     | {}                      | 200     |
| POST   | `/admin/categories`                | `createAdminCategory`     | body                    | 201     |
| QUERY  | `/admin/categories/{id}`           | `getAdminCategoryById`    | params                  | 200     |
| PATCH  | `/admin/categories/{id}`           | `updateAdminCategory`     | params, body (optional) | 200     |
| DELETE | `/admin/categories/{id}`           | `removeAdminCategory`     | params                  | 200     |
| POST   | `/admin/projects`                  | `createAdminProject`      | body                    | 201     |
| QUERY  | `/admin/projects`                  | `listAdminProjects`       | query                   | 200     |
| QUERY  | `/admin/projects/{id}`             | `getAdminProjectById`     | params                  | 200     |
| PATCH  | `/admin/projects/{id}`             | `updateAdminProject`      | params, body (optional) | 200     |
| DELETE | `/admin/projects/{id}`             | `deleteAdminProject`      | params                  | 200     |
| POST   | `/admin/uploads/logo`              | `requestLogoUpload`       | body                    | 200     |
| DELETE | `/admin/uploads/logo`              | `removeLogoUpload`        | body                    | 200     |
| POST   | `/admin/uploads/logo/change`       | `changeLogoUpload`        | body                    | 200     |
| POST   | `/admin/uploads/screenshot`        | `requestScreenshotUpload` | body                    | 200     |
| DELETE | `/admin/uploads/screenshot`        | `removeScreenshotUpload`  | body                    | 200     |
| POST   | `/admin/uploads/screenshot/change` | `changeScreenshotUpload`  | body                    | 200     |
| QUERY  | `/list-commits`                    | `getCommits`              | none                    | 200     |
| QUERY  | `/categories`                      | `listPublicCategories`    | {}                      | 200     |
| QUERY  | `/categories/by-path`              | `getCategoryByPath`       | query                   | 200     |
| QUERY  | `/health`                          | `checkHealth`             | none                    | 200     |
| QUERY  | `/projects/{slug}`                 | `getProjectBySlug`        | params                  | 200     |
| QUERY  | `/projects`                        | `listProjects`            | query                   | 200     |
| QUERY  | `/projects/search`                 | `searchProjects`          | query                   | 200     |

IDs/slugs use explicit primitive path styles. Every query field is a scalar and
uses an explicit primitive query style; numeric pagination and upload sizes keep
existing coercion. There are no consumed input headers; authentication remains in
context/middleware. Create and update forms validate the shared body schemas,
then wrap values at the RPC boundary. PATCH body omission, omitted fields, null
removals, slug/repository normalization, category deduplication, and defaults retain
runtime behavior.

`project.listCategories({})` and `admin.project.listCategories({})` keep their flat
RPC input/output shapes and have no OpenAPI mapping. Both REST routing and spec
filters continue to exclude them. Health and commits keep no-input contracts, and
category lists keep their existing `{}` inputs. The server's plain Hono `QUERY /`
is outside oRPC and keeps its text response. RPC accepts `QUERY` for reads and no
longer accepts `GET`; the web RPC client already uses `QUERY`. Better Auth routes
and the reference HTML/spec remain served by their existing `GET` handlers.

The installed beta.42 converter correctly represents these schemas, so no JSON
schema registry overrides are needed. `QUERY` requires OpenAPI 3.2; the installed
generator emits 3.2.0. Generated OpenAPI matches the captured wire contract with
read methods changed from `get` to `query`. ID-only DELETE operations no longer
advertise phantom empty request bodies. Their HTTP requests still need only the
path ID.

Mapping guidance: [oRPC input/output mapping](https://orpc.dev/docs/openapi/input-and-output-mapping)
and [Zod integration](https://orpc.dev/docs/integrations/zod). The database-free
`tests/openapi-mapping.test.ts` exercises every mapped operation and compares its
spec with `tests/fixtures/openapi-wire-contract.json`, captured from the base commit.
The fixture deduplicates response schemas and shared errors; do not regenerate it
from the migrated contracts when validating compatibility.

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
