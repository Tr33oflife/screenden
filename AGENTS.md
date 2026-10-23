# ScreenDen agent instructions

- Read README.md, CHANGELOG.md and HANDOFF.md before changing source.
- This is the public edition. It was forked by snapshot from a private
  build; the private build is a separate project and is never modified by
  work here, and nothing private is ever copied back in — no hostnames,
  addresses, names, history or documents from it.
- Every change must pass the scrub gate before it ships: no personal
  strings in code, defaults, docs, tests, release notes or filenames.
- Preserve the working Nextcloud Shared Files WebDAV parser; compare it
  against the pre-fork baseline before release.
- Do not reactivate the archived Ombi Lab experiment without explicit
  project instruction.
- On EVERY code change, update CHANGELOG.md and the in-app RELEASE_NOTES
  with changes, tests, failures and unverified items, and update
  HANDOFF.md status.
- Version surfaces move together: frontend version/build-agent constants,
  Worker APP_VERSION/APP_BUILD_AGENT, asset cache slugs, guide footer.
- After any worker.js edit, re-embed the standalone assets, extract and
  validate SITE_HTML, SITE_JS and SITE_CSS; run node --check on the Worker
  and the extracted JS; run the full test suite.
- Never claim live browser, Plex, Cloudflare, D1 or Nextcloud
  verification based on syntax checks.
- No secrets in source, packages, logs or frontend.
- Icons are vendored SVG files in-tree; no CDN icon scripts (they break
  offline/self-contained use).
- A release is not complete until evidence exists: verify from a fresh
  extraction of the packaged artifact, report limitations plainly, and
  keep a rollback copy.
