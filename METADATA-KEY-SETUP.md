# Metadata provider credentials — setup

## One-time Cloudflare setup
In Cloudflare Dashboard > Workers & Pages > your deployed Worker > Settings > Variables and Secrets, add a **Secret** named `METADATA_ENCRYPTION_KEY`. Use a unique, random value of at least 32 characters (for example generate with `openssl rand -hex 32`). Redeploy if required by Cloudflare. Keep a secure backup: changing or losing this value makes saved credentials unreadable. Do not place it in public code or commit it to Git.

The Worker must already have the `DB` D1 binding used by ScreenDen. The encrypted credentials table is created automatically.

## In the app
Log in as administrator > Settings > Administration > Metadata connections & game library. Paste each provider credential into its password field and click **Save key**. The field clears after saving and the key is not shown again. Remove deletes the encrypted record.

Obtain keys:
- TMDB: https://www.themoviedb.org/settings/api (TMDB API key v3)
- RAWG: https://rawg.io/apidocs
- IGDB: create a Twitch developer app at https://dev.twitch.tv/console/apps to obtain Client ID, then request an OAuth app access token using Twitch authentication instructions: https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/ . IGDB tokens expire and must be replaced; automatic refresh is not implemented.

## Security / limitations
- Credentials are AES-GCM encrypted at rest in D1 using a key derived from `METADATA_ENCRYPTION_KEY`. The key itself remains a Worker secret.
- Existing Worker secrets for providers remain supported as fallbacks, but dashboard-saved credentials override them.
- This does not verify provider credentials on save. Test each provider with a metadata search after saving.
- This has been syntax checked, not live-tested against Cloudflare/D1/providers.
