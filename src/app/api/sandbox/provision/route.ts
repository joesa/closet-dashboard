import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';

// Temporary password generator
function generateTempPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      businessName, 
      theme, 
      layoutStyle,
      subdomain, 
      ownerEmail,
      heroHeadline,
      aboutDescription,
      heroImage,
      beforeImage,
      services,
      aiSiteConfig,
      aiWidgetConfig
    } = body;

    if (!businessName || !theme || !subdomain || !ownerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Create Tenant
    const tenantId = uuidv4();
    const widgetId = uuidv4(); // Mock widget ID for sandbox
    
    const { error: tenantError } = await supabase.from('tenants').insert({
      id: tenantId,
      business_name: businessName,
      owner_email: ownerEmail,
      widget_id: widgetId,
      subscription_status: 'active',
      site_status: 'active'
    });

    if (tenantError) throw tenantError;

    // 2. Create Domain mapping
    const { error: domainError } = await supabase.from('domains').insert({
      tenant_id: tenantId,
      hostname: `${subdomain}.localhost`,
      is_primary: true,
      ssl_status: 'active'
    });

    if (domainError) throw domainError;

    // 3. Define the Master Services Catalog Mapping
    const serviceCatalog: Record<string, any> = {
      'Walk-In Closets': {
        image: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
        description: 'Luxurious walk-in spaces designed for your lifestyle.'
      },
      'Reach-In Closets': {
        image: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
        description: 'Maximize every inch with precision reach-in designs.'
      },
      'Garages': {
        image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
        description: 'High-performance garage environments built to last.'
      },
      'Pantries & Wine': {
        image: 'https://images.unsplash.com/photo-1556910103-1c02745a872f', 
        description: 'Elegant storage for culinary and wine collections.'
      },
      'Home Offices': {
        image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36', 
        description: 'Productive and beautifully organized workspaces.'
      },
      'Mudrooms': {
        image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a', 
        description: 'Seamless entryways that handle daily chaos.'
      },
      'Wall Beds': {
        image: 'https://images.unsplash.com/photo-1505693314120-0d443867891c', 
        description: 'Transformative sleep solutions for multi-use rooms.'
      },
      'Entertainment Centers': {
        image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5', 
        description: 'Sleek media walls for the ultimate viewing experience.'
      }
    };

    const selectedServices = (services && services.length > 0) ? services : ['Walk-In Closets'];

    // 4. Create Site Config with dynamic portfolio mapping (or AI overrides)
    let siteConfigData = {
      tenant_id: tenantId,
      brand_name: businessName,
      theme: theme,
      layout_style: layoutStyle || 'standard',
      default_room: 'Custom Space',
      hero_config: {
        headline: heroHeadline || `Welcome to ${businessName}`,
        backgroundImage: heroImage || "/brands/lumina/hero.png"
      },
      about_config: {
        description: aboutDescription || `${businessName} provides premium custom storage solutions tailored to your life.`
      },
      process_config: {
        title: "Our Process",
        subtitle: "How we work",
        steps: [
          { number: "01", title: "Consultation", description: "We meet with you." },
          { number: "02", title: "Design", description: "We design it." },
          { number: "03", title: "Install", description: "We build it." }
        ]
      },
      products_config: selectedServices.map((serviceName: string) => {
        const catalogItem = serviceCatalog[serviceName] || {
          image: "https://images.unsplash.com/photo-1558211583-d26f610c1eb1",
          description: "Premium custom storage solution."
        };
        return {
          title: serviceName,
          image: catalogItem.image,
          description: catalogItem.description,
          details: {
            subtitle: "Bespoke Design",
            longDescription: `Full architectural build out for your ${serviceName}. Our team designs and fabricates perfectly tailored solutions to elevate your space.`,
            specifications: ["Premium Materials", "Precision Fit", "Lifetime Warranty"]
          }
        };
      }),
      seo_config: {
        legalName: businessName,
        phone: "555-0199",
        streetAddress: "123 Main St",
        addressLocality: "Anytown",
        addressRegion: "NY",
        postalCode: "10001",
        geo: { latitude: "40.7128", longitude: "-74.0060" }
      },
      before_after_config: {
        beforeImage: beforeImage || "/brands/lumina/before.png",
        afterImage: heroImage || "/brands/lumina/hero.png",
        title: `The ${businessName} Transformation`,
        subtitle: "Drag to see"
      }
    };

    if (aiSiteConfig) {
      siteConfigData = {
        ...siteConfigData,
        theme: aiSiteConfig.theme || siteConfigData.theme,
        hero_config: aiSiteConfig.hero || siteConfigData.hero_config,
        about_config: aiSiteConfig.about || siteConfigData.about_config,
        process_config: aiSiteConfig.process || siteConfigData.process_config,
        products_config: aiSiteConfig.products || siteConfigData.products_config,
      };
      
      // If the AI generated multi-page configuration
      if (aiSiteConfig.pagesConfig && aiSiteConfig.pagesConfig.length > 0) {
        (siteConfigData as any).pages_config = aiSiteConfig.pagesConfig;
        
        // Build the global navigation links automatically based on the AI's pages
        const navLinks = [{ label: 'Home', slug: '/' }];
        aiSiteConfig.pagesConfig.forEach((page: any) => {
          navLinks.push({ label: page.title, slug: page.slug });
        });
        (siteConfigData as any).nav_links = navLinks;
      }
      
      // Merge images back in if the AI left them out or used the placeholders
      if (!siteConfigData.hero_config.backgroundImage) {
         siteConfigData.hero_config.backgroundImage = heroImage || "/brands/lumina/hero.png";
      }
    }

    const { error: configError } = await supabase.from('site_configs').insert(siteConfigData);

    if (configError) throw configError;

    // 4b. Insert Widget Customizations if generated by AI
    if (aiWidgetConfig) {
      const { customRooms, customAddOns, customFinishes } = aiWidgetConfig;
      
      // 1. Insert Custom Rooms
      if (customRooms && customRooms.length > 0) {
        const roomsToInsert = customRooms.map((r: any) => ({
          contractor_id: tenantId, // using tenantId since contractor settings ID is the same
          name: r.name,
          price_basic: r.basic || 0,
          price_standard: r.standard || 0,
          price_premium: r.premium || 0
        }));
        await supabase.from('contractor_rooms').insert(roomsToInsert);
      }

      // 2. Insert Custom Addons
      if (customAddOns && customAddOns.length > 0) {
        const addonsToInsert = customAddOns.map((a: any) => ({
          contractor_id: tenantId,
          name: a.name,
          room_type: a.roomType,
          price: a.price || 0
        }));
        await supabase.from('contractor_addons').insert(addonsToInsert);
      }

      // 3. Insert Custom Finishes
      if (customFinishes && customFinishes.length > 0) {
        const finishesToInsert = customFinishes.map((f: any, i: number) => ({
          contractor_id: tenantId,
          label: f.label,
          description: f.description,
          swatch_hex: f.swatchHex || '#cccccc',
          tier: f.tier || 'basic',
          sort_order: i
        }));
        await supabase.from('contractor_finishes').insert(finishesToInsert);
      }

      // 4. Disable all default rooms and finishes to force the widget to only show the AI's custom ones
      const defaultRoomsToDisable = [
        'Walk-In Closet', 'Reach-In Closet', 'Garage', 'Pantry & Wine', 
        'Home Office', 'Laundry Room', 'Mudroom', 'Entertainment Center', 
        'Wall Beds', 'Craft Room', 'Home Library', 'Kid Spaces', 
        'Dressing Room', 'Home Storage'
      ];
      const defaultFinishesToDisable = ['basic', 'standard', 'premium'];

      // We need to create a contractor_settings row since it doesn't get created automatically until onboarding is fully done in some flows, 
      // but here we are in sandbox provision. Let's upsert it.
      await supabase.from('contractor_settings').upsert({
        id: tenantId, // contractor_settings primary key is the same as tenantId
        company_name: businessName,
        disabled_default_rooms: defaultRoomsToDisable,
        disabled_default_finishes: defaultFinishesToDisable
      });
    }

    if (configError) throw configError;

    // 5. Create Auth User & Email Credentials
    const tempPassword = generateTempPassword();
    
    // Check if user exists first (this is a sandbox, but good practice)
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u => u.email === ownerEmail);
    
    if (!existingUser) {
      const { error: authError } = await supabase.auth.admin.createUser({
        email: ownerEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          force_password_reset: true,
          tenant_id: tenantId,
          widget_id: widgetId, // Link widget ID for easy access
        }
      });
      if (authError) console.error("Failed to create auth user:", authError);
    } else {
      // If user exists, we might want to update their password to the new temp one just for the sandbox demo
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password: tempPassword,
        user_metadata: { force_password_reset: true, tenant_id: tenantId, widget_id: widgetId }
      });
    }

    // 6. Send Email via Resend
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const dashboardUrl = 'http://localhost:3001/login'; // Hardcoded for sandbox

      await resend.emails.send({
        from: 'ClosetQuote <admin@closetquotes.com>',
        to: [ownerEmail],
        subject: `Welcome to ClosetQuote! Your site is pending approval.`,
        html: `
          <h1>Welcome, ${businessName}!</h1>
          <p>Your custom site has been provisioned and is currently pending admin approval.</p>
          <p>In the meantime, you can log in to your dashboard to manage your widget and settings.</p>
          <br/>
          <p><strong>Login URL:</strong> <a href="${dashboardUrl}">${dashboardUrl}</a></p>
          <p><strong>Email:</strong> ${ownerEmail}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <br/>
          <p><em>Note: You will be required to change this password upon your first login.</em></p>
        `
      });
    }

    return NextResponse.json({ 
      success: true, 
      url: `http://${subdomain}.localhost:3000`,
      // Return temp password just in case resend fails locally
      tempPassword 
    });

  } catch (error: any) {
    console.error('Sandbox provision error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
