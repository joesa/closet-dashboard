-- Gallery images for the Portfolio / Gallery page.
-- Stored as an array of public URLs (after upload to site-assets storage).
alter table prospect_intakes
  add column if not exists gallery_images text[] not null default '{}';
