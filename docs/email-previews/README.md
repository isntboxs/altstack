# Synthetic email previews

Generated from the real shared components using `vpx`; there are no real
recipients, user data, live credentials or magic-link tokens in these artifacts.
The sign-in URL is an inert example. Review links use the local preview origin;
they demonstrate destinations and do not implement an application on this port.

- Magic Link: [HTML](magic-link.html), [plain text](magic-link.txt).
- Published: [HTML](published.html), [plain text](published.txt).
- Rejected: [HTML](rejected.html), [plain text](rejected.txt).

Regenerate and serve from the repository root:

```sh
vp run --filter @altstack/ui email:preview
python3 -m http.server 4174 --bind 127.0.0.1 --directory docs/email-previews
```

Open `http://localhost:4174/published.html` (or another variant) so the absolute
local PNG URL resolves. Rendering does not import server env, connect to a DB
or call Resend. The copied PNG belongs only to this preview directory; its
runtime original is `apps/web/public/brand/altstack-email-symbol.png`.

## Fresh verification — 2026-10-23

- Targeted API review/resubmit/history and new notification tests: **146 passed**
  across four files in the final scoped run.
- Auth Magic Link sender, PostgreSQL lifecycle/quota and cookies: **44 passed**.
- Shared email rendering/escaping/unsafe URLs: **8 passed**.
- Private submission routing/navigation and sign-in form: **23 passed**.
- Review notification CLI lifecycle/logging: **5 passed**.
- Additive outbox migration, preservation, rerun, constraints and account cascade:
  **1 passed**. DB-backed runs used the README disposable-schema wrapper.
- Scoped formatting, typed lint and typechecks for UI/auth/API/DB/env/server/web;
  email UI, auth, API, DB/env and server builds; affected web production build.
  The web build retains third-party `use client` bundling warnings.
- Browser client output was inspected for email copy, Resend API and server
  renderer markers; none were found. Dedicated email imports do not enter the
  ordinary browser UI bundle.

T3 collaborative browser inspection covered all three variants at **1280 px**
and **360 px**, including the PNG loading, CTA/link destinations, readable
line breaks and absence of horizontal overflow. Long unbroken names/feedback,
literal HTML-like feedback and hidden external images were also inspected at
360 px: content wraps and the text wordmark remains visible. CTA contrast is
21:1; body contrast is about 7.8:1. HTML output stays below the 102 KB clipping
threshold in the synthetic cases. Fonts fall back to Arial/Helvetica locally.

These are browser rendering checks, not screenshots from actual mail clients.
No live Resend sending, production migration, deployment, scheduler activation,
OAuth/Upstash integration or Gmail/Outlook/Apple Mail inbox acceptance was run.
Full root/recursive suites were not run. Earlier verification counts in other
feature documents are historical and have not been repeated wholesale here.
