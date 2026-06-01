# ClosetQuote Data Model

ClosetQuote has two related-but-distinct data models that share one Supabase
database. This doc explains how they relate, after the Phase 3 reconciliation.

## The two models

### 1. `contractor_settings` model — pricing & billing identity

The original SaaS model. A `contractor_settings` row is the identity the
**embedded quote widget** uses:

- `contractor_settings` — company info, per-room/finish pricing, Stripe billing,
  trial state. Its `id` is the widget's `contractorId`.
- `contractor_rooms`, `contractor_addons`, `contractor_finishes` — pricing
  catalog, all FK'd to `contractor_settings(id)` via `contractor_id`.
- `leads`, `quote_events` — widget submissions and telemetry.
- `scraper_leads` — Maps scraper / outreach records (`run_id`, pipeline); **not** widget form rows.

The widget APIs (`/api/calculate`, `/api/send-lead`, `/api/settings`) all key off
`contractor_settings.id`.

### 2. `tenants` model — site & branding identity

The newer multi-tenant website model (consumed by `custom-closets-websites`):

- `tenants` — business tenant, `site_status`, `widget_id`, Stripe.
- `domains` — `hostname` -> `tenant_id` routing.
- `site_configs` — JSONB site content (hero, products, theme, layout, pages).

## The bridge: `tenants.widget_id`

`tenants.widget_id` is the single link between the two models. It points at the
`contractor_settings.id` whose pricing/settings power the widget embedded on that
tenant's site.

After reconciliation (migrations `20260530120000` and `20260530120100`), the
invariant is:

```
tenant.id == tenant.widget_id == contractor_settings.id   (per provisioned tenant)
```

- `20260530120000_reconcile_tenant_widget_id.sql` backfills a
  `contractor_settings` row for every tenant and sets `widget_id = tenant.id`.
- `20260530120100_tenant_widget_id_fk.sql` adds
  `tenants_widget_id_fkey` (`tenants.widget_id -> contractor_settings.id`,
  `ON DELETE RESTRICT`) so the relationship can't silently drift.
- `/api/sandbox/provision` creates both rows with the same id, so every new
  tenant satisfies the invariant from creation.

### Why this matters

Before reconciliation, tenant sites reused the shared **demo** contractor id
(`ec376123-...`) or a random `widget_id` with no settings row. Both broke the
widget on real tenant domains:

- the demo id triggered the demo-origin gate (`403 demo_restricted`), and
- a random id 404'd in `/api/calculate` (no `contractor_settings` row).

Keeping `widget_id = contractor_settings.id` guarantees a real, tenant-owned
pricing identity that never hits the demo gate.

## `leads` vs `scraper_leads`

| Table | Source | Key columns |
|-------|--------|-------------|
| `public.leads` | `/api/send-lead` (widget) | `contractor_id`, quote snapshot, contact form |
| `public.scraper_leads` | `/api/scraper/run-status` on run complete | `run_id`, `business_name`, pipeline fields |

Unsubscribe webhooks (Twilio STOP, Instantly Unsubscribed) query **both** tables to correlate phone ↔ email.

Migration `20260531120000_scraper_leads.sql` adds the scraper table. An earlier migration attempted a conflicting `leads` shape with `CREATE TABLE IF NOT EXISTS` (no-op on existing DBs).

## Future direction

This is a **lightweight reconciliation**: the two tables remain separate but are
now guaranteed consistent. A future full unification (collapsing `tenants` and
`contractor_settings` into one canonical row, or making one strictly own the
other) can build on this invariant without a data-cleanup phase.

## Prospect intake: services and site presentation

`prospect_intakes` stores what the contractor offers and how auto-provision should look:

| Column | Role |
|--------|------|
| `services` | Text array of catalog labels from `contractorServices.ts` (16 grouped checkboxes). May include sentinel `Other (describe below)` when the custom line is used. |
| `other_services` | Optional free text (1–120 chars) when **Other** is checked; used in AI briefs and as an extra product line. |
| `ai_site_config` | JSON from AI generate-site; may include `presentation: { theme, layoutStyle, resolvedAt, rationale, source }` for audit. |

**Presentation resolution** (`resolveSitePresentation`): unions per-service theme/layout pools from the catalog, applies vibe/CTA hints, optional Gemini pick, and sets `defaultRoom` for the widget. Used on template auto-provision, AI Premium provision (layout no longer hardcoded to `standard`), and intake generate-site (merged after Gemini).

Theme/layout slugs are defined in `src/lib/catalog/sitePresentationCatalog.ts` and must stay in sync with `custom-closets-websites` `ThemeType` and `ClientPage` layout switch.
