# ScreenDen handoff — public edition

## What this is

ScreenDen is the public edition of a private household media hub: a
single Cloudflare Worker combining Plex browsing/playback with community
features and optional Nextcloud and Uptime Kuma modules. It was forked by
snapshot from the private build; the private build is a separate project,
is never modified by work here, and nothing private is copied back in.
Read AGENTS.md for the standing rules.

## Current state — 1.0.0-rc.1 (P1: scrub snapshot, 2026-10-23; published to a public GitHub repository the same day — see "Publication")

Pre-publication fixes were folded into rc.1 before it was published
anywhere (it is the same candidate, hardened):
- the inherited entry-gate default (the private server's name acting as
  a known default answer) → a neutral starter question ("What is this
  hub called?") and answer (`screenden`), replaced the moment an admin
  sets their own; pinned by test-gate-defaults.mjs;
- the preview CORS allowlist → a placeholder origin
  (`https://preview.example.com`) instead of a deployed Pages origin;
- the Plex client identity and the config-backup format carry the
  ScreenDen name (backup import still accepts the legacy format);
- repository packaging added: expanded README (full description +
  deploy instructions), SETUP.md, wrangler.example.jsonc, .gitignore,
  tools/ (build-embed, check-embedded, public scrub gate).

- Snapshot source: the current private build, 3.6.36, copied read-only.
- Public version surfaces are ScreenDen's own: version 1.0.0-rc.1,
  build agent "ScreenDen contributors", asset slugs `?v=1.0.0-rc.1`.
- Scrub applied (scripted in the distro workspace,
  `public-distro/tools/build-p1-snapshot.py`, every replacement counted
  and asserted):
  - private seedbox host/port → placeholders (`your-server.example.com`,
    standard explicit-FTPS port) in the Downloads page and the FTP guide;
  - report email recipient → the `REPORT_TO_EMAIL` Worker secret; without
    it (or without the Resend secrets) reports are stored in-app only.
    Diagnostics reports the channel configured only when all three
    secrets are present;
  - the archived Ombi Lab URL → a neutral placeholder;
  - private Nextcloud server names in UI examples and test fixtures →
    neutral names (Server One / Server Two / Archive);
  - product name and defaults → ScreenDen throughout.
- Not carried over: private history documents (changelog, progress,
  handoff, build metadata, reviews), the in-app release-notes archive
  (public notes start at 1.0.0-rc.1), the seeded roadmap history
  (replaced with a fresh public timeline), the stale frontend check copy,
  and the original PDF guide. The PDF is a private document that names
  the private server in its text and cannot be scrubbed; the public
  edition ships the HTML guide only and the PDF route is removed
  (test-ftp-guide asserts it is not served).
- License: MIT (LICENSE), holder "ScreenDen contributors".

## Verification (P1 + publication pass)

- Baseline: the private 3.6.36 test suite passed 30/30 on a pristine
  copy before the snapshot.
- Public tree: `node --check` clean on worker/frontend/discovery;
  embedded-assets check passes (SITE_JS parses, 307,005 chars);
  SITE_JS is byte-identical to frontend.js and SITE_CSS to styles.css
  after re-embedding. The snapshot script rebuilds the tree from the
  private source and reproduces the verified worker byte-for-byte.
- Public tree suite: 31/31 test files pass (30 carried over + the new
  gate-defaults test, 7 assertions).
- Scrub gate (full private denylist, kept outside this repo): 0 blocking
  hits over the tree and over a fresh extraction of the packaged ZIP;
  the extracted copy also passes the suite 31/31. The in-repo gate
  (tools/scrub-gate.py) runs the generic checks and is green too.
- worker.js SHA-256 (after the gate-branding fix below):
  cbfa827deb66ae6da0794d86d243b646806bbe7acf9136bb1845fe74aa74b823
- Donate button added 2026-10-23 (owner's standard Ko-fi widget,
  verbatim): a floating Donate button in the main app shell. This is
  the one intentional public link to the owner's donation profile in
  the tree — the internal gate allowlists worker.js for that handle
  only, and the snapshot zero-check skips the widget line. Worker
  after this change: 418f0eae5db1a274354091a169b0a282b1e1c27f75f1048303900faf81c4b406.
- Donate button toggle added 2026-10-23 (same day): the widget is no
  longer hardcoded in the shell. An admin checkbox in Settings →
  Appearance & branding stores a `donations` flag in the branding
  settings (default on); /api/dashboard/config serves it as a
  boolean and the frontend injects the Ko-fi script only while it is
  on, removing it live when turned off. The gate allowlist moved to
  frontend.js plus its embedded copy in worker.js. Pinned by
  test-donate-toggle.mjs (suite now 32 files). Worker after this
  change: 84225b071933182093f2dea99dc1859f54fc7c5a18da50f655d9ba90f50cf1a9.
  Tracked counts now: Download Centre 29, tavern 517, version refs 86.
- Donate button form replaced 2026-10-23 (owner's call, pushed from
  the private line's final v3.6.39 form): the floating Ko-fi overlay
  widget is gone — no widget script anywhere. The button is a
  footer-only mini button: plain link in the footer nav, dark
  #323842 pill, white Donate text, 12px, static position. The admin
  toggle still gates it (footer renders the link only while the
  flag is on). The scrub gate now forbids the widget terms
  outright (donate test excepted, since it asserts their absence),
  and test-donate-toggle.mjs pins the new form and rejects the old
  one. Browser-verified: link present with href + #323842 + 12px +
  static position, no widget script, off → gone, on → back.
  Worker after this change:
  0b64e049aff03414234b9ef969587414f6d2223d2e503d567d2e9ef88f3d66ad.
  Tracked counts now: Download Centre 30, tavern 518, version refs 86.
- Browser rendering IS now verified locally: a demo instance of this
  exact tree (local server, real sqlite D1, demo-only secrets, sample
  fixture data with fictional titles/art) was screenshotted with
  headless Chromium — gate, home, Continue Watching rails, Games,
  Requests, Downloads, FTP guide, Settings and a mobile home, zero page
  errors. That pass caught the gate page still saying "Welcome to The
  Tavern" in its heading/title; fixed to ScreenDen (worker + snapshot
  script) and re-verified. The screenshots live in docs/screenshots/
  and on the README. NOT verified: any live Cloudflare deploy or real
  Plex/Nextcloud/Kuma behaviour. No public deployment of the public
  edition has been performed; the deploy instructions in the
  README/SETUP are written from the code's actual requirements
  (binding name, secret names and length rules, first-run flow) and
  are scheduled for an end-to-end walk before the 1.0.0 tag.

## Publication

- Public GitHub repository: this repository (published under the
  owner's GitHub account). First commit (b2b81bd) is this scrubbed snapshot tree — 50 files;
  there is no private history in it. Verified live after push: the
  repository is public, the README renders as the project page, and the
  raw worker.js served by GitHub hashes identically to the verified
  local worker (266caa06…).
- Release v1.0.0-rc.1 (pre-release) carries the verified ZIP asset;
  it was re-issued after the gate-branding fix (final SHA-256 in the
  distro record, P1-REPORT addendum).
- Repository description and topics (plex, cloudflare-workers,
  self-hosted, nextcloud, uptime-kuma, media-server, wrangler, d1)
  are set.
- Note for maintainers: the distro snapshot script preserves this
  tree's .git directory across rebuilds.

## Known debt — tracked, scheduled for P2 (not hidden)

The gate reports these as non-blocking counts:

- Community naming: the private build's community features carry its
  server's name (user-visible labels like the news section and the
  personalisation page, plus internal identifiers such as the
  `mh_tavern` table, `/api/tavern` routes and the base theme id).
  516 references over the packaged tree. P2 does the rename pass and decides how much of the
  internal naming moves (identifiers are a data-compatibility question,
  not a find-replace).
- Download Centre: still present with placeholder details (27 tracked
  references). It is cut from public v1 by decision; the cut is P2 work.
- Private-line version references in code comments (e.g. "(v3.6.36)"):
  86, cosmetic only.

## Next phases

- P2 — Generalize: the community-naming rename pass, the Download
  Centre cut, and a fresh-eyes pass on defaults/empty states so a
  stranger can point the build at their own Plex/Nextcloud from the
  setup guide alone. (The neutral-defaults part is partly done: the
  entry gate already ships neutral.)
- P3 — Packaging: DONE early at the owner's request (repo scaffold,
  README/SETUP, wrangler template, in-repo tools). Remaining P3 item:
  walk SETUP.md end-to-end against a real fresh Cloudflare account
  before the 1.0.0 tag.
- P4 — First public release: 1.0.0 tagged from the verified artifact.
