# Contributing

Start with [local setup](README.md#run-locally) and the
[development guide](docs/development.md). Check the [roadmap](docs/roadmap.md)
before proposing a large feature. A repository license is still undecided; this
guide does not declare one.

## Issues

Search existing issues first. For bugs, describe the expected and actual behavior,
minimal reproduction steps, affected revision, and relevant runtime versions.
Use synthetic records and redact logs. For feature requests, describe the user
problem, a concrete use case, and the smallest useful outcome.

Report vulnerabilities through [SECURITY.md](SECURITY.md). Keep `.env` files,
tokens, cookies, real contact information, internal domains, and production
deployment details out of issues, pull requests, fixtures, and screenshots.

## Pull requests

1. Keep each change focused on one outcome and follow nearby code conventions.
2. Update shared schemas/contracts before changing API consumers. Enforce
   permissions in the API, including private/public response boundaries.
3. Include reviewed forward migrations for schema changes. Preserve existing
   data and the migration journal; use disposable schemas for verification.
4. Run the smallest relevant format/lint, type, and test checks. State exactly
   which checks passed and which integrations remain unverified.
5. Update the relevant guide when commands, configuration, permissions, or user
   behavior change. Add notable user-facing changes under `Unreleased` in
   [CHANGELOG.md](CHANGELOG.md).

The PR description should explain the problem, resulting behavior, validation,
and any migration/configuration steps. Use synthetic screenshots for visible UI
changes and mention provider-dependent acceptance separately. Review the staged
diff for generated output and sensitive values before submitting.

## Validation scope

Follow [AGENTS.md](AGENTS.md#testing-scope). Documentation-only edits need diff,
link, and formatting checks. Code changes need affected tests and scoped lint/type
checks. Database-backed tests use `test:scoped` with local `altstack_test`.
Full-suite commands are reserved for explicit requests or justified broad impact.
See [targeted examples](docs/development.md#targeted-verification).

## Documentation and releases

Write public guides in English with runnable commands and synthetic examples.
Use localhost or reserved `example.com`/`.example` hosts for deployment examples;
upstream source and vendor documentation links may use their real public URLs.
Keep private operations records outside this repository.

Use the five guides linked from the [root README](README.md#documentation-and-contributing):
development for setup/configuration/imports, architecture for implementation
boundaries, deployment for operations, the PRD for feature behavior and scope,
and the roadmap for priorities. Update these guides before adding another file.
Keep exact API field definitions in the contracts/shared schemas and link to them.
Production evidence, provider resource IDs, and incident records belong in private
operator storage; historical check counts do not establish current validation.

For a release, move notable `Unreleased` entries into a versioned section with
the release date. Group entries under Added, Changed, Deprecated, Removed, Fixed,
or Security as applicable; omit empty groups. Include migration and configuration
actions an operator needs. Verify release contents against tags before backfilling
history, and reuse the same notes for GitHub Releases. Do not publish sensitive
vulnerability details before coordinated disclosure.
