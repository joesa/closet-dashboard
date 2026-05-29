-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: The Core Tenant Record
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255) UNIQUE,
    widget_id UUID NOT NULL,
    subscription_status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: The Domain Router
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    hostname VARCHAR(255) UNIQUE NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    ssl_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: The Site Configuration (JSONB Payload)
CREATE TABLE IF NOT EXISTS site_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    brand_name VARCHAR(255) NOT NULL,
    theme VARCHAR(50) NOT NULL DEFAULT 'luxury-minimal',
    default_room VARCHAR(100) NOT NULL,
    
    hero_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    about_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    process_config JSONB NOT NULL DEFAULT '{"steps": []}'::jsonb,
    products_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    seo_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for Edge Speed
CREATE INDEX IF NOT EXISTS idx_domains_hostname ON domains USING HASH (hostname);

-- --------------------------------------------------------
-- SEED DATA FOR EXISTING DEMOS
-- --------------------------------------------------------

-- 1. Lumina Custom Closets
DO $$
DECLARE
    lumina_tenant_id UUID := uuid_generate_v4();
BEGIN
    INSERT INTO tenants (id, business_name, owner_email, widget_id)
    VALUES (lumina_tenant_id, 'Lumina Custom Closets', 'demo-lumina@closetquotes.com', 'ec376123-f499-4ad4-88c9-2b63ad6f90ab');

    INSERT INTO domains (tenant_id, hostname, is_primary, ssl_status)
    VALUES (lumina_tenant_id, 'lumina.localhost', true, 'active');

    INSERT INTO site_configs (tenant_id, brand_name, theme, default_room, hero_config, about_config, process_config, products_config, seo_config)
    VALUES (
        lumina_tenant_id,
        'Lumina Custom Closets',
        'luxury-minimal',
        'Walk-In Closet',
        '{"headline": "Refined Storage For Elevated Living", "backgroundImage": "/brands/lumina/hero.png"}'::jsonb,
        '{"description": "Lumina Custom Closets brings architectural precision to the most personal spaces in your home. We specialize in high-end, bespoke storage systems that blend seamless functionality with gallery-like restraint. Every project is an exercise in quiet luxury."}'::jsonb,
        '{"title": "Our Seamless Process", "subtitle": "From Vision to Flawless Reality", "steps": [{"number": "01", "title": "Bespoke Consultation", "description": "We collaborate closely to capture your storage needs, wardrobing habits, and stylistic preferences."}, {"number": "02", "title": "3D Spatial Rendering", "description": "Visualize your exact space with high-fidelity digital mockups detailing materials, lighting, and finishes."}, {"number": "03", "title": "Precision Installation", "description": "Our veteran craftsmen handle the full build with absolute structural integrity and millimeter accuracy."}]}'::jsonb,
        '[{"title": "Walk-In Closet", "image": "/brands/lumina/product-1.png", "description": "A serene, fully customized walk-in closet designed around wardrobe flow, visibility, and effortless organization. High-gloss cabinetry, integrated lighting, and refined hardware create a polished boutique experience at home.", "details": {"subtitle": "The Signature Boutique Suite", "specifications": ["Material: 3/4-inch architectural grade composite with high-gloss acrylic facing", "Lighting: Warm 2700K integrated flush LED strip channels with motion sensors", "Hardware: Undermount soft-close full-extension drawer runners"], "longDescription": "Crafted for seamless wardrobe flow and immaculate visual organization. This layout features fully integrated floor-to-ceiling vertical shelving, concealed custom backing panels, and structural island options."}}, {"title": "Boutique Dressing Room", "image": "/brands/lumina/product-3.png", "description": "A private dressing space crafted for elegance, comfort, and daily ritual. Velvet-lined drawers, glass display shelving, and soft illumination showcase accessories with gallery-like restraint.", "details": {"subtitle": "Private Master Dressing Room", "specifications": ["Material: Ultra-matte Italian laminate with solid oak dovetail drawer boxes", "Lighting: Perimeter and in-drawer illumination with circadian rhythm dimming", "Hardware: Polished brass custom pulls and concealed hinges"], "longDescription": "An expansive, meticulously crafted dressing room designed as a sanctuary. The integration of seating areas, soft lighting, and extensive glass-paneled display cabinets elevates the daily routine to an art form."}}, {"title": "Integrated Home Office", "image": "/brands/lumina/product-2.png", "description": "A minimalist workspace seamlessly built into custom floor-to-ceiling cabinetry for a clean, architectural look. Concealed storage, premium wood finishes, and a refined desk layout keep the room calm, functional, and beautifully uncluttered.", "details": {"subtitle": "Executive Workspace Design", "specifications": ["Material: Rift-sawn white oak veneer with wire-management routing", "Storage: Deep-file integrated drawers and push-to-open upper cabinets", "Hardware: Minimalist edge pulls and soft-close drop-down fronts"], "longDescription": "A minimalist workspace seamlessly built into custom floor-to-ceiling cabinetry for a clean, architectural look. Designed to conceal technology and clutter while showcasing curated literature and art."}}]'::jsonb,
        '{"legalName": "Lumina Custom Closets", "phone": "+1-800-555-0199", "streetAddress": "100 Luxury Ave", "addressLocality": "Nashville", "addressRegion": "TN", "postalCode": "37201", "geo": {"latitude": "36.1627", "longitude": "-86.7816"}}'::jsonb
    );
END $$;

-- 2. Ironclad Storage Co.
DO $$
DECLARE
    ironclad_tenant_id UUID := uuid_generate_v4();
BEGIN
    INSERT INTO tenants (id, business_name, owner_email, widget_id)
    VALUES (ironclad_tenant_id, 'Ironclad Storage Co.', 'demo-ironclad@closetquotes.com', 'ec376123-f499-4ad4-88c9-2b63ad6f90ab');

    INSERT INTO domains (tenant_id, hostname, is_primary, ssl_status)
    VALUES (ironclad_tenant_id, 'ironclad.localhost', true, 'active');

    INSERT INTO site_configs (tenant_id, brand_name, theme, default_room, hero_config, about_config, process_config, products_config, seo_config)
    VALUES (
        ironclad_tenant_id,
        'Ironclad Storage Co.',
        'brutalist',
        'Garage Workshop',
        '{"headline": "Built For Garages That Dominate", "backgroundImage": "/brands/ironclad/hero.png"}'::jsonb,
        '{"description": "Ironclad Storage Co. engineers brutalist, high-performance garage environments for those who demand absolute durability. We construct heavy-duty steel cabinet walls, precision slatwall systems, and metallic epoxy floors that turn ordinary garages into elite automotive and workshop spaces. No compromises, just strength."}'::jsonb,
        '{"title": "The Ironclad Execution", "subtitle": "Engineered For Heavy Duty", "steps": [{"number": "01", "title": "Site Assessment", "description": "We evaluate wall studs, floor gradients, and electrical routing to plan a structurally flawless grid."}, {"number": "02", "title": "Heavy-Duty Prep", "description": "Concrete is diamond-ground and patched. Walls are reinforced to handle extreme loads."}, {"number": "03", "title": "Industrial Build", "description": "We deploy steel cabinetry and industrial-grade epoxies with military precision."}]}'::jsonb,
        '[{"title": "Steel Cabinet Workshop", "image": "/brands/ironclad/product-1.png", "description": "A brutalist garage storage wall built with matte black steel cabinets, reinforced drawer systems, and rugged diamond-plate trim. Designed for heavy tools, clean workflow, and a workspace that feels as strong as it performs.", "details": {"subtitle": "The Titan Tool Suite", "specifications": ["Material: 18-gauge welded steel frames with scratch-resistant powder coat", "Hardware: 200lb-capacity ball-bearing drawer slides and magnetic latches", "Surfaces: 1.5-inch solid bamboo or stainless steel worktops"], "longDescription": "A brutalist garage storage wall built with matte black steel cabinets, reinforced drawer systems, and rugged diamond-plate trim. This modular layout secures thousands of pounds of gear behind lockable, double-walled steel doors."}}, {"title": "Industrial Slatwall System", "image": "/brands/ironclad/product-2.png", "description": "A precision-mounted black slatwall organization system for power tools, impact wrenches, storage bins, and shop essentials. Every component is arranged with geometric discipline so the garage stays sharp, functional, and visually commanding.", "details": {"subtitle": "Geometric Tool Grid", "specifications": ["Material: Heavy-duty extruded PVC cellular panels (75lbs per sq/ft capacity)", "Accessories: Industrial rubber-coated steel hooks and magnetic tool bars", "Trims: Extruded aluminum edge banding for structural rigidity"], "longDescription": "A precision-mounted black slatwall organization system that covers the entire perimeter. Keep power tools, impact wrenches, and heavy extension cords visibly organized and instantly accessible."}}, {"title": "Metallic Epoxy Garage Floor", "image": "/brands/ironclad/product-3.png", "description": "A flawless dark charcoal metallic epoxy floor with a seamless high-gloss finish built for elite automotive spaces. Its mirror-like surface reflects tool chests, hexagonal lighting, and custom cabinetry for a cinematic industrial edge.", "details": {"subtitle": "Cinematic Auto Showroom Floor", "specifications": ["Material: 100% solid commercial-grade polyaspartic epoxy blend", "Application: 4-layer diamond-ground bonding process with moisture barrier", "Finish: UV-stable, high-gloss clear coat with anti-slip micro-aggregate"], "longDescription": "A flawless dark charcoal metallic epoxy floor with a seamless high-gloss finish built for elite automotive spaces. Impervious to hot tires, oil spills, and dropped tools."}}]'::jsonb,
        '{"legalName": "Ironclad Storage Co. LLC", "phone": "+1-615-555-0199", "streetAddress": "1400 Industrial Blvd", "addressLocality": "Nashville", "addressRegion": "TN", "postalCode": "37201", "geo": {"latitude": "36.1627", "longitude": "-86.7816"}}'::jsonb
    );
END $$;

-- 3. Hearth & Home Spaces
DO $$
DECLARE
    hearth_tenant_id UUID := uuid_generate_v4();
BEGIN
    INSERT INTO tenants (id, business_name, owner_email, widget_id)
    VALUES (hearth_tenant_id, 'Hearth & Home Spaces', 'demo-hearth@closetquotes.com', 'ec376123-f499-4ad4-88c9-2b63ad6f90ab');

    INSERT INTO domains (tenant_id, hostname, is_primary, ssl_status)
    VALUES (hearth_tenant_id, 'hearth.localhost', true, 'active');

    INSERT INTO site_configs (tenant_id, brand_name, theme, default_room, hero_config, about_config, process_config, products_config, seo_config)
    VALUES (
        hearth_tenant_id,
        'Hearth & Home Spaces',
        'classic-warm',
        'Mudroom',
        '{"headline": "Beautiful Rooms For Everyday Living", "backgroundImage": "/brands/hearth/hero.png"}'::jsonb,
        '{"description": "Hearth & Home Spaces creates beautifully organized, deeply practical utility rooms designed around family life. From custom mudroom drop-zones to walk-in kitchen pantries and serene laundry rooms, we build spaces that bring calm, warmth, and effortless structure to the hardest-working areas of your home."}'::jsonb,
        '{"title": "Building Your Sanctuary", "subtitle": "A thoughtful, family-first approach", "steps": [{"number": "01", "title": "Home Consultation", "description": "We visit your home to understand your family''s daily routines, pain points, and flow."}, {"number": "02", "title": "Custom Design", "description": "We craft a personalized storage layout focusing on warmth, accessibility, and durable materials."}, {"number": "03", "title": "White-Glove Build", "description": "Our team installs your new space cleanly and respectfully, ready for immediate everyday use."}]}'::jsonb,
        '[{"title": "Custom Mudroom Lockers", "image": "/brands/hearth/product-1.png", "description": "A warm, family-ready mudroom designed with built-in lockers, coat hooks, upper storage bins, and structured shoe cubbies. Natural wood accents, soft finishes, and practical details create an inviting drop-zone that keeps daily life beautifully organized.", "details": {"subtitle": "The Family Drop-Zone", "specifications": ["Material: Painted maple wood construction with beadboard backing", "Hardware: Antique brass double coat hooks and soft-close storage benches", "Surfaces: Solid butcher block or durable quartz seating surfaces"], "longDescription": "A warm, family-ready mudroom designed with built-in lockers, coat hooks, upper storage bins, and structured shoe cubbies. It ensures every backpack, coat, and pair of boots has a dedicated, out-of-sight home."}}, {"title": "Walk-In Kitchen Pantry", "image": "/brands/hearth/product-2.png", "description": "A custom pantry built for calm, visible, and effortless kitchen storage. Wooden shelving, matching glass jars, wicker baskets, and pull-out spice racks turn everyday ingredients into a perfectly arranged domestic retreat.", "details": {"subtitle": "The Culinary Pantry", "specifications": ["Material: L-shaped custom shelving with adjustable vertical tiers", "Storage: Hand-woven pull-out rattan baskets and tiered can organizers", "Lighting: Under-shelf warm LED strip lighting activated upon entry"], "longDescription": "A custom pantry built for calm, visible, and effortless kitchen storage. Wooden shelving, matching glass jars, wicker baskets, and pull-out spice racks turn everyday ingredients into a perfectly arranged domestic retreat."}}, {"title": "Laundry Room Cabinetry", "image": "/brands/hearth/product-3.png", "description": "A bright utility space with shaker-style cabinetry, folding counters, hanging racks, and integrated storage around modern appliances. Designed to make laundry feel lighter, cleaner, and more peaceful for the entire household.", "details": {"subtitle": "The Serene Laundry Suite", "specifications": ["Material: Moisture-resistant MDF shaker cabinets in soft linen white", "Surfaces: Extended solid-surface folding counters with integrated sink", "Accessories: Pull-out drying racks, concealed ironing boards, and hamper bins"], "longDescription": "A bright utility space with shaker-style cabinetry, folding counters, hanging racks, and integrated storage around modern appliances. Designed to make laundry feel lighter, cleaner, and more peaceful for the entire household."}}]'::jsonb,
        '{"legalName": "Hearth & Home Spaces", "phone": "+1-888-555-0199", "streetAddress": "200 Suburban Ln", "addressLocality": "Franklin", "addressRegion": "TN", "postalCode": "37064", "geo": {"latitude": "35.9251", "longitude": "-86.8689"}}'::jsonb
    );
END $$;
