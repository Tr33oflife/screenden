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
- worker.js SHA-256:
  266caa06c026cbcd0fcacbe5d5e1da6d1eaed9f3904e0df5a11e9df3b226bd80
- NOT verified: any live Cloudflare deploy, real Plex/Nextcloud/Kuma
  behaviour, or browser rendering of the public edition. No deployment
  of the public edition has been performed; the deploy instructions in
  the README/SETUP are written from the code's actual requirements
  (binding name, secret names and length rules, first-run flow) and are
  scheduled for an end-to-end walk before the 1.0.0 tag.

## Publication

- Public GitHub repository: https://github.com/Tr33oflife/screenden
  First commit (b2b81bd) is this scrubbed snapshot tree — 50 files;
  there is no private history in it. Verified live after push: the
  repository is public, the README renders as the project page, and the
  raw worker.js served by GitHub hashes identically to the verified
  local worker (266caa06…).
- Release v1.0.0-rc.1 (pre-release) carries the verified ZIP asset
  (screenden-1.0.0-rc.1.zip, SHA-256 53574d93…).
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
