-- Create a public Storage bucket for bespoke AI-generated site imagery.
-- The bespoke image pipeline (/api/ai/generate-images) renders 16:9 hero +
-- product images with gpt-image-1 and uploads them here under
-- 'site-assets/<slug>/<key>.png'. Public read lets custom-closets-websites
-- render them via next/image; service-role writes bypass RLS.
-- ON CONFLICT keeps this idempotent across the shared-DB migrate workflow.
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;
