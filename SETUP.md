# ScreenDen setup — the full walk

The short version lives in the README (Deploy). This page is the
checklist version, plus every optional module. Work top to bottom;
nothing here is required beyond the "Core" section.

## Core

- [ ] D1 database created; binding named exactly `DB`.
- [ ] Secrets set: `ADMIN_PASSWORD`, `GATE_SESSION_SECRET` (32+ random
      characters), `METADATA_ENCRYPTION_KEY` (32+ random characters,
      backed up somewhere safe).
- [ ] `worker.js` deployed (Wrangler or dashboard code editor).
- [ ] Opened the site, answered the starter gate question
      ("What is this hub called?" → `screenden`).
- [ ] Signed in as admin and **replaced the gate question and answer
      with your own** (Settings → Administration, entry question,
      Save Changes). The starter answer stops working the moment you
      save.
- [ ] Signed in with Plex, selected the household server, confirmed the
      home page loads libraries and posters.
- [ ] Recommended extra secret: `PLEX_SESSION_SECRET` (32+ random
      characters). Without it, Plex sessions use a fallback value.

## Plex notes

- Sign-in is the standard plex.tv PIN flow; ScreenDen discovers the
  signed-in account's servers itself, races every published connection
  address and remembers the winner, so remote and local addresses both
  work without configuration.
- Members sign in with their own Plex accounts; libraries shown are
  the ones Plex already shares with them. ScreenDen adds no access of
  its own.
- Admin-only tools (weekly picks, game publishing, diagnostics) verify
  titles against a server the admin can reach before publishing.

## Optional: Nextcloud shared files feed

- [ ] Set `NC_DAV_URL` (the WebDAV base, ending in `/remote.php/dav/files/<user>/`
      or your instance's equivalent), `NC_USER` and `NC_APP_PASSWORD`
      (an app password, not the account password).
- [ ] The Shared Files feed and folder browsing now work for members.
- [ ] For *personal* Nextcloud connections (each member connects their
      own account in the file browser), also set
      `NC_LAB_ENCRYPTION_KEY` (32+ characters, backed up — rotating it
      invalidates stored connections) and add servers under
      Settings → Administration → Nextcloud browser.

## Optional: Uptime Kuma service status

- [ ] Set `KUMA_STATUS_URL` to your public status page URL, ending in
      `/status/<slug>`.
- [ ] Make sure the Cron Trigger exists (`*/5 * * * *`) — see
      KUMA-SCHEDULER-SETUP.md. Without cron you still get live status;
      cron is what builds the incident history.

## Optional: report email

Reports are always stored in the app. To also email them, set
`RESEND_API_KEY`, `REPORT_FROM_EMAIL` and `REPORT_TO_EMAIL` — full
steps in REPORT-EMAIL-SETUP.md.

## Optional: metadata providers

Steam needs no key. For TMDB / RAWG / IGDB, either set the matching
secrets (`TMDB_API_KEY`, `RAWG_API_KEY`, `IGDB_CLIENT_ID` +
`IGDB_ACCESS_TOKEN`) or save keys in the app under
Settings → Administration → Metadata connections (encrypted with
`METADATA_ENCRYPTION_KEY` — see METADATA-KEY-SETUP.md). Choose the
default provider per media type in the same panel.

## Optional: Discord alerts and Web Push

Both are configured in the app (Settings → Administration →
Notifications): paste a Discord webhook per channel (admin / public),
and generate the Web Push (VAPID) keys in-panel. Nothing to set on the
Worker.

## Optional: Downloads page (FTP guide)

The Downloads page and the illustrated FTP guide ship with placeholder
connection details (`your-server.example.com`). They are written for a
household that shares files from an FTP/seedbox account: if that is
you, the page structure (connection card with Copy buttons, the guide,
troubleshooting) is a starting point you can adapt in `frontend.js`
(and re-embed). If it is not you, hide the page in the Home layout
editor / widget settings.

## Backup, restore, rollback

- Configuration backup: Settings → Administration exports/imports a
  JSON backup (format `screenden-config`; backups exported by older
  builds with the legacy format are also accepted on import).
- Rollback a bad deploy by redeploying the previous `worker.js`. The
  database is untouched by rollbacks; schema is created additively.

## Troubleshooting

- **"Configure GATE_SESSION_SECRET" (503):** the secret is missing or
  shorter than 32 characters.
- **Gate answer rejected after you set your own:** that is the design —
  the starter answer is replaced, not added to.
- **Diagnostics page (Settings → Administration → Diagnostics)** reports
  live reachability for the database, Plex, Nextcloud, the service
  monitor, metadata and email, and shows whether the page and the
  server agree on the running version — the first place to look when
  something seems stale or half-configured. It shows statuses only,
  never secret values.
