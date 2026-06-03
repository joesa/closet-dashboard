-- Prospect-selected site pages so the admin/AI build doesn't have to guess the
-- sitemap. 'Home' is always implied; this stores the additional pages chosen.
ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS requested_pages text[] NOT NULL DEFAULT '{}';
