-- Add the before_after_config JSONB column to site_configs
ALTER TABLE site_configs 
ADD COLUMN IF NOT EXISTS before_after_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Seed dummy data for Lumina
UPDATE site_configs
SET before_after_config = '{
    "beforeImage": "/brands/lumina/product-1.png",
    "afterImage": "/brands/lumina/hero.png",
    "title": "The Lumina Transformation",
    "subtitle": "Drag to see the difference"
}'::jsonb
WHERE brand_name = 'Lumina Custom Closets';

-- Seed dummy data for Ironclad
UPDATE site_configs
SET before_after_config = '{
    "beforeImage": "/brands/ironclad/product-1.png",
    "afterImage": "/brands/ironclad/hero.png",
    "title": "The Ironclad Transformation",
    "subtitle": "Drag to see the difference"
}'::jsonb
WHERE brand_name = 'Ironclad Storage Co.';

-- Seed dummy data for Hearth & Home
UPDATE site_configs
SET before_after_config = '{
    "beforeImage": "/brands/hearth/product-1.png",
    "afterImage": "/brands/hearth/hero.png",
    "title": "The Hearth Transformation",
    "subtitle": "Drag to see the difference"
}'::jsonb
WHERE brand_name = 'Hearth & Home Spaces';
