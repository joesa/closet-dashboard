-- Admin/seeded design-variant override for generated sites.
--
-- The tenant renderer (custom-closets-websites) composes a structural design
-- variant procedurally from a stable site seed so every site diverges. This
-- optional column lets an operator FORCE a specific named "studio style" preset
-- (or leave it null/empty for the default per-site seeded selection).
--
-- Valid values: '' / null (Auto, seeded) or a preset id from
-- designVariantCatalog.ts (kept in sync with custom-closets-websites
-- src/lib/designVariants.ts).
alter table site_configs
  add column if not exists design_variant text;
