# Security

## Reporting a vulnerability

Avoid disclosing exploit details, credentials, personal data, or affected private
deployments in public issues or pull requests.

If this repository's **Security** tab offers **Report a vulnerability**, use that
private reporting flow. Its availability depends on the repository settings.
If it is unavailable, ask a maintainer to establish a private reporting channel
without describing the vulnerability publicly. No dedicated security email or
response-time commitment is published yet.

Once a private channel is available, include the affected revision, expected and
actual behavior, minimal synthetic reproduction, impact, and any suggested fix.
Use an instance you control and avoid including live secrets or database dumps.

## Maintenance scope

No supported-release or backport matrix is published yet. Report the exact
revision and check whether the issue also occurs on the current source.

## Public repository hygiene

Keep real environment files, authentication URLs/tokens, session cookies, provider
credentials, backup archives, deployment identifiers, and production exports out
of commits and logs. `.env.example` documents variable names and examples only.
Public `VITE_*` values are embedded in browser bundles and must contain no secrets.

Removing a value from the latest tree does not remove it from Git history, forks,
or existing artifacts. If a real credential was committed, revoke/rotate it and
coordinate any required history cleanup separately.
