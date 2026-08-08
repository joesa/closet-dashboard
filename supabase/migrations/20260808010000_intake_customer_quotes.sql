-- Real customer quotes for the Reviews & Testimonials page.
--
-- Policy (plan: eliminate AI tells): testimonials are NEVER fabricated. The
-- testimonials page is generated only from quotes the contractor supplies
-- here, verbatim; when this column is empty the page is omitted from the
-- generated sitemap and page-copy generation refuses the slug.

ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS customer_quotes text;

COMMENT ON COLUMN public.prospect_intakes.customer_quotes IS
  'Verbatim customer quotes supplied by the contractor (one per line, optionally "Quote" - Name). The only sanctioned source for testimonial copy; never AI-invented.';
