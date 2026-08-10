-- Password-protect spec previews.
--
-- The offer link alone is unguessable, but it travels by SMS and can be
-- forwarded. A password the recipient must type means a forwarded link is not
-- enough on its own — only the person holding the text can open the site.
--
-- Only the HASH lives here. The password itself is derived on demand from the
-- spec build id and SPEC_PREVIEW_SECRET, so there is no plaintext at rest: the
-- dashboard can re-derive it whenever it needs to put it in a message, and the
-- renderer only ever compares hashes.
--
-- On site_configs rather than spec_builds because the renderer already loads
-- site_configs for every request and knows nothing about spec builds.
ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS spec_preview_password_hash TEXT;

COMMENT ON COLUMN public.site_configs.spec_preview_password_hash IS
  'HMAC of the spec preview password. Set when a spec build is approved, cleared on acceptance so the paying owner is never asked for one.';
