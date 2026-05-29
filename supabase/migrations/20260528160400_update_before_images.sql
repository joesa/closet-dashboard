-- Update dummy data for Lumina
UPDATE site_configs
SET before_after_config = '{
    "beforeImage": "/brands/lumina/before.png",
    "afterImage": "/brands/lumina/hero.png",
    "title": "The Lumina Transformation",
    "subtitle": "Drag to see the difference"
}'::jsonb
WHERE brand_name = 'Lumina Custom Closets';

-- Update dummy data for Ironclad
UPDATE site_configs
SET before_after_config = '{
    "beforeImage": "/brands/ironclad/before.png",
    "afterImage": "/brands/ironclad/hero.png",
    "title": "The Ironclad Transformation",
    "subtitle": "Drag to see the difference"
}'::jsonb
WHERE brand_name = 'Ironclad Storage Co.';

-- Update dummy data for Hearth & Home
UPDATE site_configs
SET before_after_config = '{
    "beforeImage": "/brands/hearth/before.png",
    "afterImage": "/brands/hearth/hero.png",
    "title": "The Hearth Transformation",
    "subtitle": "Drag to see the difference"
}'::jsonb
WHERE brand_name = 'Hearth & Home Spaces';
