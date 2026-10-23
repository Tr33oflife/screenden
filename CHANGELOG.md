# ScreenDen changelog

The public line starts here. It does not carry the history of any private
build; versions are the public edition's own.

## 1.0.0-rc.1 — 2026-10-23 — First public snapshot

- Snapshot of the current private build (3.6.36), taken read-only; the
  private build itself is unchanged and continues independently.
- Scrubbed for public distribution, proven by the denylist scrub gate
  (zero blocking hits over the release tree):
  - the private seedbox host and port are replaced with placeholders
    (`your-server.example.com`, standard port) in the Downloads page and
    the FTP guide;
  - the hardcoded report recipient is gone — reports are emailed only
    when the admin configures `REPORT_TO_EMAIL` (plus Resend secrets),
    and are otherwise stored in the app;
  - the archived Ombi Lab URL is a neutral placeholder;
  - the private Nextcloud server names in examples and test fixtures are
    replaced with neutral names;
  - build attribution is the neutral "ScreenDen contributors", and the
    product name, defaults and version are ScreenDen's own
    (1.0.0-rc.1) throughout.
- Not carried over: all private project history documents and build
  metadata, the in-app release-notes archive (the public line starts its
  own notes at 1.0.0-rc.1), the seeded roadmap history (replaced with a
  fresh public timeline), and the original PDF guide — a private document
  that names the private server in its text and cannot be scrubbed. The
  public edition ships the HTML guide only; the PDF guide route is
  removed.
- License: MIT, with a neutral contributors holder.
- Pre-publication fixes (same day, before first publish): the inherited
  entry-gate default — the private server's name, working as a known
  default answer — is replaced by a neutral starter question ("What is
  this hub called?") and answer (`screenden`), which stops working the
  moment an admin sets their own; a new test (test-gate-defaults.mjs)
  pins that behaviour. The preview CORS allowlist now points at a
  placeholder origin instead of a deployed one, the Plex client identity
  carries the ScreenDen name, and configuration backups export in the
  `screenden-config` format while still importing the legacy format.
- One more default caught by the demo screenshots (same day): the gate
  page's own heading and title still carried the private community name
  ("Welcome to The Tavern") — they now say ScreenDen, matching the
  button that already did.
- Repository packaging: README expanded into the full project page
  (description, deploy instructions for Wrangler and the dashboard,
  configuration reference), SETUP.md added with the full setup walk,
  a Wrangler template (wrangler.example.jsonc), .gitignore, and tools/
  (embed/check scripts and the public scrub gate).
- Verification: the private baseline suite passed 30/30 before the
  snapshot; the public tree's suite result is recorded in HANDOFF.md.
  No live Cloudflare, Plex or Nextcloud verification has been performed
  on the public edition.
