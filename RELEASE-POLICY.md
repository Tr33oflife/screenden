# Release requirements

For every public release, however minor:

1. Increment the version in `frontend.js` (`MEDIA_HUB_VERSION`), the Worker
   (`APP_VERSION`), the asset cache slugs (`?v=…`) and the FTP guide footer —
   all four surfaces move together.
2. Add a truthful entry to CHANGELOG.md and the in-app RELEASE_NOTES array.
   The public changelog starts at 1.0.0-rc.1; do not import history from any
   private build.
3. Verify the standalone frontend and the embedded SITE_JS match exactly
   (re-embed with the build-embed tool; never edit one copy alone).
4. Run the full test suite and the JavaScript syntax checks; distinguish
   syntax validation from deployment and runtime tests.
5. Run the scrub gate over the release tree. Zero blocking hits or the
   release stops.
6. Verify the packaged artifact from a fresh extraction of it, not from the
   working tree.
7. Do not claim live verification unless it was actually performed.
