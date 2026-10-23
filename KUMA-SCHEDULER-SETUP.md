# Continuous Uptime Kuma incident sampling — deployment setup

## Cloudflare Dashboard (manual ZIP Worker deployments)

1. Deploy `worker.js` from this package to the **existing** ScreenDen Worker (do not create a second Worker).
2. In Cloudflare Workers & Pages → your ScreenDen Worker → **Settings / Triggers**, add a **Cron Trigger** with `*/5 * * * *` (every five minutes, UTC). The exact tab name may vary in the dashboard.
3. Confirm the existing **D1 binding `DB`** remains connected and **`KUMA_STATUS_URL`** points to the public HTTPS Uptime Kuma status page ending in `/status/<slug>`.
4. Check Worker **Logs** for `Kuma scheduled poll:` or `Kuma scheduled poll failed:` after the next scheduled invocation.
5. Open ScreenDen → Help → Service incident history and check the D1 archive after an actual monitored status transition.

**Important:** Uploading the ZIP/Worker code alone does NOT activate the cron trigger. The Cloudflare trigger must be configured once. Cron triggers can take several minutes to propagate. Cloudflare scheduling is best effort, not real-time; brief outages between polls can still be missed. Existing public Uptime Kuma heartbeat history may help recover events included in its retention window.

**Data handling:** The scheduled task fetches only the configured public status-page endpoints; no gate session or admin login is needed. It stores transitions in the existing `mh_kuma_status_events` D1 table, deduplicated by monitor ID, event timestamp and status. Visitor-triggered snapshots remain supported.

**Rollback:** Remove the Cron Trigger in Cloudflare and redeploy the prior ZIP. The D1 history table can remain; do not delete it unless you intentionally want to lose incident history.
