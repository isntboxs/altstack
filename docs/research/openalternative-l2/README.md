# OpenAlternative reference investigation for L2

Collected on 2026-10-15 Asia/Jakarta, against the public website at
<https://openalternative.co>. AltStack baseline commit:
`be5059f84de44fd3d46ef22bbb343b49823c0d13`.

Deliverable: [L2 implementation brief](../../l2-ui-spec.md). This directory records
the evidence behind its recommendations. It does not change application behavior
or mark the launch UI acceptance complete.

## Method and retained artifacts

The T3 collaborative browser navigated the homepage, Supabase detail, categories
and a missing slug. It inspected guest Verify/Save, opened and dismissed Report,
opened Embed and observed copied feedback, exercised mobile menus, searched with
a sentinel query, and tested keyboard dismissal and command search. No account
was created, no email was requested and no report or authenticated write was sent.

- [Browser observations](browser-observations.json) are a manually assembled
  finding ledger, not REA Evidence. OA IDs identify those browser observations.
- [Bundle manifest](bundle-manifest.json) identifies the four selected public
  scripts, exact byte digests and acquisition method.
- [Static extract](rea-static-extract.json) projects REA's source-bound endpoint
  observations and coverage into a small reviewable artifact.
- [Mobile scenario](rea-mobile-scenario.json) contains the exact declared launch,
  viewport, actions and capture options.
- [Mobile extract](rea-mobile-extract.json) records the independent REA scenario's
  completed steps, cleanup, provenance and limitations. Its final accessibility
  capture establishes the More menu contents.
- [Evidence manifest](evidence-manifest.json) records local original Evidence
  paths and file hashes for verification.

The compact extracts were made with Python from complete REA JSON. They are
**projections, not new canonical Evidence records**. Full canonical records are
kept in the ignored `.l2-research.local/` directory at the repository root, so
they do not add a 40 MB generated graph or copied website prose to version control:

```text
.l2-research.local/rea-application.json
.l2-research.local/rea-static-evidence.json.gz
.l2-research.local/rea-browser-result.json
.l2-research.local/selected-bundles/
```

These local originals are available in this workspace. A new clone has the
manifests/extracts/scenario, not those originals. Reacquiring a later deployment
can produce different script hashes and Evidence IDs.

## REA identities and boundaries

CLI: `rea-agents@6.4.0`, installed skill version 37. REA MCP tools were absent from
the active harness; the supported public CLI was used without changing MCP
registration or installing a native analysis engine.

Static application Evidence:

```text
ev_efabc74536a8326eb31970194d9852381d9ba09a477cbe1312dafeb22ed9b09b
```

Controlled browser Evidence:

```text
ev_e5f2fd0df59e8bac269405363f69685d19f1d2bd091f9259afaa5208cfed5e4b
```

The static input was four selected scripts, 117,481 UTF-8 bytes, from a 44-URL
inventory of scripts loaded during the detail investigation. All four parsed
without parse failures. REA inventoried that selected container completely;
semantic coverage is partial/unknown and Turbopack module boundaries were not
recovered (`modules = 0`). This is not a complete application/backend analysis.

The static endpoint observations include:

- `orpc.bookmarks.check` and `orpc.bookmarks.set`;
- `orpc.reports.create`;
- `orpc.tools.sendVerificationOtp` and `orpc.tools.confirmVerificationOtp`;
- `orpc.tools.filterOptions`.

One additional heuristic endpoint candidate is `next`. Do not treat that generic
candidate as a proven service API, or the analyzer's mechanism label as proof of
a specific RPC framework. All endpoint conclusions remain static syntax facts.

Direct terminal acquisition received HTTP 403. Same-origin browser fetch with
`credentials: 'omit'` returned HTTP 200 and supplied the selected script bytes.
The public scripts were parsed as inert text; their bootstrap code was not
executed by static REA analysis.

The mobile REA scenario launched a provider-owned Chromium 152.0.7977.82 with a
fresh temporary profile, 390 × 844 CSS viewport, English locale, Asia/Jakarta
timezone, light theme and reduced motion. It completed start navigation, waited
for More, opened it and waited for Report; the provider terminated its owned
browser. This validates that specific interaction, not all mobile accessibility
or authenticated behavior. Native touch hardware/user-agent emulation was not
part of the declared scenario.

## Reproduction

From the root workspace, after selecting the retained exact script files:

```bash
rea analyze-javascript-application "$PWD/.l2-research.local/selected-bundles" \
  --analysis-timeout-ms 30000 --format json \
  > "$PWD/.l2-research.local/rea-application.json"

rea capture-browser-scenario \
  "$PWD/docs/research/openalternative-l2/rea-mobile-scenario.json" \
  --format json > "$PWD/.l2-research.local/rea-browser-result.json"
```

Use an existing `rea` CLI. In the original environment its public launcher was
under `/home/mrboxs/.npm/_npx/dea9475797100b20/node_modules/.bin/rea`. If acquiring
the pinned CLI again, run `npx -y rea-agents@6.4.0` outside this Bun-managed
workspace: npm otherwise refuses the project's `devEngines.packageManager`.
The scenario explicitly uses `/usr/lib/chromium/chromium`; a different machine
must select its own installed executable. Do not substitute another target.

The `inspect-analysis-view` helper exited 143 before writing its summary. Its
reason was not established. Analysis was not repeated: bounded Python extraction
used the complete successful original Evidence, preserving IDs and limitations.

## Question checklist

- **Answered:** what public detail actions do for a guest, Report/Embed opening,
  copied feedback, Report Escape/focus return, mobile More/category navigation,
  command-search empty state, rendered not-found recovery, current AltStack gaps,
  L2 work packages and future feature dependencies.
- **Partially answered:** homepage query/reset, and client integration structure.
  Full filter/history semantics and a complete module graph are not established.
- **Unverified on the reference:** authenticated verification/bookmarks, report
  processing, screenshot absence/failure, forced slow/offline/server-error states,
  full keyboard focus-trap auditing and real mobile devices. The corresponding
  AltStack recommendations require controlled local tests during implementation.

T3's snapshot raster metadata stayed at 1280 × 800 even when the measured page
viewport changed. Saved native screenshots were inspected, but exact pixel-layout
claims use DOM viewport/overflow readings and the declared REA scenario instead.
T3 snapshots also truncate the semantic tree and omit network/action sections;
focused reads and the separately retained REA capture supplied the missing detail.

The first mobile category clicks timed out because the menu had already been
closed. Opening it before selecting the link and waiting for the destination
heading succeeded. No unresolved site-navigation failure is inferred from those
initial timeouts.

## Validation of the research deliverable

On the baseline source plus these documentation changes:

- `vp install`: passed; dependency installation reported no changes.
- `vp fmt` on the changed/new documentation: passed.
- `vp check`: passed formatting, lint and type checks without warnings/errors.
- `vp run --filter @altstack/db test:scoped -- vp test run`: **925 passed,
  1 skipped** across 58 files; the skipped integration remains opt-in Upstash.
- Six JSON artifacts parse; original/selected-source Evidence file hashes match;
  all 17 local links in the brief and this README resolve; `git diff --check` passed.
- HTML summary previewed at 728 px dark and 390 px light without console errors.

These results validate the documentation change against the existing source.
Actual L2 UI implementation, production build and release/staging browser
acceptance remain the next work.
