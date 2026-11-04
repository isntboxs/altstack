# React Doctor review predicates

These are source-backed review notes, not scanner suppressions. Recheck every
predicate when the referenced code changes. No rule is disabled by this file.

## Hydration of catalogue offsets

`react-doctor/no-hydration-branch-on-browser-global` at `ProjectListSection`
and the collections directory is a false positive only while both use
`useCatalogueOffset`. That hook must keep its `useHydrated()` gate: the initial
server and hydration snapshot use the fixed display-slot offset, and browser
storage is read after hydration. `apps/web/tests/catalogue-offset-hydration.test.tsx`
checks both catalogue identities with a conflicting stored offset and asserts
that hydration reports no recoverable error. Do not exempt direct render-time
storage access elsewhere.

## Native select names supplied by FieldLabel

`react-doctor/control-has-associated-label` on `ad-tier`, `ad-status` and
`ad-order-status` is a false positive while each select's ID matches its adjacent
`FieldLabel.htmlFor`. The shared FieldLabel renders a native label. The advertising
admin and order tests exercise these controls using their accessible labels.

## Member project form drafts

`react-doctor/no-derived-useState` in `MemberProjectEditor` is intentional only
while its caller in `src/routes/_main/managed/$id.tsx` keys the editor by both
project ID and revision. The editor owns unsaved input; a new project/revision
remounts it. A continuously mounted editor receiving a different project would
need a new review.

## Mutation cache ownership

The member editor's `react-doctor/query-mutation-missing-invalidation` finding
does not account for its `save` handler, which awaits `mutateAsync`, catalogue
invalidation, ownership-key invalidation and router invalidation. Those steps
must remain on the successful save path.

The project report mutation returns a receipt and closes the reporting viewer's
dialog; that viewer has no report-inbox query. Do not add admin-only cache reads
or invalidation solely to silence the detector. Review again if the reporting
viewer starts displaying a cached report list.

## Authentication return destination

`react-doctor/clickjacking-redirect-risk` in `src/routes/auth/route.tsx` is a false
positive only while the destination passes through `resolveReturnTo` immediately
before redirecting. That resolver rejects external origins, protocol-relative
paths, backslashes, control characters, malformed encodings and auth loops. The
malicious-destination cases in `apps/web/tests/sign-in-form.test.tsx` protect this
contract. This does not exempt unrelated redirects or framing configuration.

## JSON serialization contract test

The `JSON.parse(JSON.stringify(result))` assertion in
`apps/web/tests/public-content-prepare.test.ts` verifies that the public content
payload survives JSON serialization unchanged. It is not an application deep
clone. Replacing it with structuredClone would remove the serialization check.

## Static text line keys

Index keys on fitted OG text lines are used by a one-shot static image renderer,
with no browser reconciliation or row-local state. Commit-message lines likewise
belong to an immutable commit keyed by commit identity. These predicates do not
exempt editable, reorderable, filterable or stateful lists. The interactive
catalogue pagination and GitHub statistics now use semantic keys.
