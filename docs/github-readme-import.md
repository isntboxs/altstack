# GitHub README import

Admins can click **Import README** in Content on both project create and edit forms. A valid public GitHub repository is required. Fetching, previewing, applying and cancelling never save a project. The existing Submit/Save controls persist Content together with the rest of the form.

Empty content defaults to Replace. Existing content requires an explicit Replace or Append selection. Append reads the latest editor document and adds paragraph separation. If the document changes after preview, Apply refreshes the preview and requires another click. Fetch failures, conversion failures and Cancel keep editor content and uploads. Changing the repository discards pending responses and previews, including when the input changes back.

The dialog shows a source link pinned to the fetched commit, conversion warnings and a read-only BlockNote preview. Preview, Apply and the public reader share the editor schema, including custom code blocks. Imports normalize through BlockNote's Markdown parse/export pipeline before preview. Pending editor exports are flushed before preview, Apply and Save. The editor's value prop still loads once; imports use an explicit operation instead of resetting the form.

## API contract

- oRPC: `admin.project.githubReadme({ repositoryUrl })`
- REST: `QUERY /admin/projects/github-readme` with JSON body `{ "repositoryUrl": "owner/repo" }` (not a GET query string).
- Output: `{ repositoryUrl, sourceUrl, path, commitSha, markdown, warnings }`.
- Authentication and admin role are required. The static endpoint is registered before `/admin/projects/{id}`.

The existing GitHub canonicalizer and public-repository verifier handle repository renames/transfers. The server resolves the default branch to a commit SHA, then requests GitHub's preferred README at that SHA with the JSON media type. Source, relative links and relative images all use that commit. Existing metadata/repository helper return shapes are unchanged.

Supported filenames have `.md`, `.markdown`, `.txt` (case-insensitive), or no extension. The server rejects empty content, invalid Base64/UTF-8, binary NUL content and decoded content above **100 KiB**, without truncation. Repository-not-found and README-not-found have distinct messages. GitHub 403/429 failures reuse the rate-limit error mapping; other upstream failures return retryable error messages.

## Conversion and safety

Markdown/GFM is parsed into an AST. Basic HTML is parsed as data, sanitized, and converted back to Markdown; raw repository HTML is never rendered or executed. Supported text, headings, lists, code, tables, links and images are kept. Custom HTML styling, alignment/layout, unsafe embedded content and event handlers are removed with warnings. GitHub-specific presentation and BlockNote's lossy Markdown conversion can change formatting.

Links allow HTTP, HTTPS and mailto; images allow HTTP and HTTPS. Relative paths resolve from the README directory, root-relative paths resolve from the repository root, and local anchors link to the pinned GitHub README. Relative images point to `raw.githubusercontent.com` at the same commit. Query strings, fragments and existing URL encoding are preserved. Code block and inline code URLs are not rewritten. Images remain remote links; the server does not fetch images, homepages or arbitrary external sites.

No environment variables, migrations, database/audit/stats writes, media imports, automatic synchronization, branch/path selection or publishing changes are introduced.

Official API reference: [Get a repository README](https://docs.github.com/en/rest/repos/contents#get-a-repository-readme). The implementation uses the installed Octokit `repos.getCommit` and `repos.getReadme` parameter/response types.

## Validation

`packages/api/tests/fixtures/github-readme.json` records the input and six-field wire output. API/wire tests cover admin authorization, repository verification, pinned reads, errors, size/encoding boundaries and static routing. Transform tests cover GFM, basic/unsafe HTML and path rewriting without external fetches. Both-form tests cover local application, explicit modes, Cancel, stale requests, retry, preserving uploads and persistence only through Save. Real BlockNote tests cover same-task flush, one-time value loading, code export and agreement with the public Markdown parser.

Run database-dependent workspace verification only with the disposable-schema wrapper:

```sh
vp run --filter @altstack/db test:scoped
```

Never use the public reset helper for this feature. Build-only placeholder Upstash values can satisfy environment validation when credentials are absent; do not use them for a deployed server or weaken the runtime schema.
