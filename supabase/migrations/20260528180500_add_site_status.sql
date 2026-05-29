-- Create an enum for site status if you prefer strict types, or just use text check.
CREATE TYPE tenant_site_status AS ENUM ('pending_approval', 'active', 'suspended');

-- Add the column to the tenants table
ALTER TABLE tenants 
ADD COLUMN site_status tenant_site_status NOT NULL DEFAULT 'pending_approval';

-- Update existing tenants to be active so we don't break the live preview immediately
-- (Though they are all mock data anyway, it's good practice)
UPDATE tenants SET site_status = 'active';
