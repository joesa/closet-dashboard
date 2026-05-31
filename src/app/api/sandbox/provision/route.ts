import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentAdmin } from '@/lib/admin';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';
import { widgetEmbedSnippet } from '@/lib/urls';

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
    // Admin-only: this creates tenants, auth users, and sends email.
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      aiWidgetConfig,
      // Real setup/contact details from a prospect intake (optional). Used to
      // persist genuine SEO/contact/lead-routing data instead of placeholders.
      intakeSetup,
      // Id of the originating prospect intake (optional) so we can mark it built.
      intakeId,
    } = body;

    const setup = (intakeSetup || {}) as {
      contactEmail?: string;
      contactPhone?: string;
      notificationEmail?: string;
      notificationPhone?: string;
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
      serviceArea?: string;
      primaryColorHex?: string;
      logoUrl?: string;
      desiredDomain?: string;
      pricingNotes?: string;
    };

    // 'full'  = Pipeline B: hosted website + embedded quote calculator.
    // 'widget' = Pipeline A: only the quote calculator widget for the prospect's
    //            existing site (no hosted site/domain). Anything else defaults to full.
    const mode: 'full' | 'widget' = body.mode === 'widget' ? 'widget' : 'full';
    const isWidgetOnly = mode === 'widget';

    // Widget-only never builds a hosted site, so theme/subdomain aren't required.
    const missingRequired = isWidgetOnly
      ? (!businessName || !ownerEmail)
      : (!businessName || !theme || !subdomain || !ownerEmail);
    if (missingRequired) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const tenantId = uuidv4();
    // The widget contractor id MUST equal an existing contractor_settings.id so
    // that /api/calculate and /api/send-lead resolve a real row (and so the
    // demo-origin gate never applies). We use the tenant id as the single
    // canonical identity.
    const widgetId = tenantId;

    // 1. Create the canonical contractor_settings row FIRST (id == tenantId ==
    // widgetId). tenants.widget_id has a foreign key to contractor_settings(id),
    // so this row must exist before the tenants insert or it fails with
    // tenants_widget_id_fkey. The AI-widget block below may later layer on
    // disabled defaults and custom rooms/finishes/add-ons.
    // Lead-routing + branding from the intake: contact_email/contact_phone drive
    // the widget's email/SMS lead alerts; primary_color_hex themes the widget.
    const settingsRow: Record<string, unknown> = { id: tenantId, company_name: businessName };
    const leadEmail = setup.notificationEmail || setup.contactEmail;
    const leadPhone = setup.notificationPhone || setup.contactPhone;
    if (leadEmail) settingsRow.contact_email = leadEmail;
    if (leadPhone) settingsRow.contact_phone = leadPhone;
    if (setup.primaryColorHex) settingsRow.primary_color_hex = setup.primaryColorHex;

    const { error: settingsError } = await supabase
      .from('contractor_settings')
      .upsert(settingsRow);
    if (settingsError) throw settingsError;

    // 2. Create Tenant (now that the referenced contractor_settings row exists)
    const { error: tenantError } = await supabase.from('tenants').insert({
      id: tenantId,
      business_name: businessName,
      owner_email: ownerEmail,
      widget_id: widgetId,
      subscription_status: 'active',
      // Widget-only tenants (Pipeline A) embed on their own site and have no
      // hosted page; the 'widget_only' status (added via migration) marks them.
      site_status: isWidgetOnly ? 'widget_only' : 'active'
    });

    if (tenantError) throw tenantError;

    // 3. Create Domain mapping + hosted Site Config — full-site (Pipeline B) only.
    // Widget-only (Pipeline A) embeds on the prospect's existing site, so it has
    // no domain/site_config; it only needs contractor_settings + widget config.
    if (!isWidgetOnly) {
    const { error: domainError } = await supabase.from('domains').insert({
      tenant_id: tenantId,
      hostname: `${subdomain}.localhost`,
      is_primary: true,
      ssl_status: 'active'
    });

    if (domainError) throw domainError;

    // 3. Define the Master Services Catalog Mapping
    const serviceCatalog: Record<string, { image: string; description: string }> = {
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

    // The AI never returns real images, and the onboarding form pre-fills a
    // single generic hero URL. To avoid every site looking identical, give each
    // theme a distinct default hero, and keep a pool of distinct product photos
    // for AI-generated products (which carry no image of their own).
    const GENERIC_HERO = 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1';
    const THEME_HERO_IMAGES: Record<string, string> = {
      'luxury-minimal': 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
      'brutalist': 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
      'classic-warm': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
      'modern-office': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
      'playful-kids': 'https://images.unsplash.com/photo-1505693314120-0d443867891c',
      'rustic-pantry': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
      'sleek-entertainment': 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
      'elegant-dressing': 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
      'functional-utility': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
      'creative-craft': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
      'sophisticated-wine': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
      'cozy-library': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
      'minimalist-zen': 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
    };
    const PRODUCT_IMAGE_POOL = [
      'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
      'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
      'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
      'https://images.unsplash.com/photo-1556910103-1c02745a872f',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
      'https://images.unsplash.com/photo-1505693314120-0d443867891c',
      'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
    ];

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
        backgroundImage: (heroImage && heroImage !== GENERIC_HERO ? heroImage : (THEME_HERO_IMAGES[theme] || GENERIC_HERO))
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
      // Real NAP from the prospect intake powers the LocalBusiness schema +
      // footer. Falls back to neutral placeholders only when not provided.
      seo_config: {
        legalName: businessName,
        phone: setup.contactPhone || "555-0199",
        streetAddress: setup.streetAddress || "123 Main St",
        addressLocality: setup.addressLocality || setup.serviceArea || "Anytown",
        addressRegion: setup.addressRegion || "NY",
        postalCode: setup.postalCode || "10001",
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
      // The operator's explicit theme dropdown is authoritative. The AI's theme
      // only pre-fills that dropdown on the client, so honoring `theme` here is
      // what lets a changed selection actually take effect.
      const finalTheme = theme || aiSiteConfig.theme;

      // The AI never returns a real hero image (only the schema placeholder), so
      // use the operator's URL, and when that's still the generic default, fall
      // back to a per-theme image so different themes don't all look the same.
      const operatorHero =
        heroImage && heroImage !== GENERIC_HERO ? heroImage : null;
      const backgroundImage =
        operatorHero || THEME_HERO_IMAGES[finalTheme] || GENERIC_HERO;

      // AI products carry no image; give each a distinct one (match the service
      // catalog by title, else rotate through the pool) so the grid isn't all
      // the same photo.
      const aiProducts = Array.isArray(aiSiteConfig.products) ? aiSiteConfig.products : null;
      const productsWithImages = (aiProducts ?? siteConfigData.products_config).map(
        (p: { title?: string; image?: string; imagePrompt?: string; [k: string]: unknown }, i: number) => {
          // Drop the transient art-direction prompt; it's only used client-side
          // to drive image generation and shouldn't be persisted on the product.
          const { imagePrompt: _imagePrompt, ...rest } = p;
          void _imagePrompt;
          return {
            ...rest,
            image: p.image || (p.title && serviceCatalog[p.title]?.image) || PRODUCT_IMAGE_POOL[i % PRODUCT_IMAGE_POOL.length],
          };
        }
      );

      // Prefer the build's own (bespoke or curated) product images for sub-page
      // image blocks so multi-page sites stay visually consistent with the home
      // page; fall back to the generic stock pool only if none are present.
      const sitePool: string[] = productsWithImages
        .map((p: { image?: string }) => p.image)
        .filter((url: string | undefined): url is string => Boolean(url));
      const pageImagePool = sitePool.length > 0 ? sitePool : PRODUCT_IMAGE_POOL;

      siteConfigData = {
        ...siteConfigData,
        theme: finalTheme,
        // Use the AI's contextual room/service type (e.g. "Minimalist Kitchen")
        // for the quote calculator CTA; fall back to the generic default.
        default_room: aiSiteConfig.defaultRoom || siteConfigData.default_room,
        hero_config: {
          headline: aiSiteConfig.hero?.headline || siteConfigData.hero_config.headline,
          backgroundImage,
        },
        about_config: aiSiteConfig.about || siteConfigData.about_config,
        process_config: aiSiteConfig.process || siteConfigData.process_config,
        products_config: productsWithImages,
      };

      // Keep the before/after slider consistent with the chosen hero.
      siteConfigData.before_after_config = {
        ...siteConfigData.before_after_config,
        afterImage: backgroundImage,
        beforeImage: beforeImage || siteConfigData.before_after_config.beforeImage,
      };

      // If the AI generated multi-page configuration
      if (aiSiteConfig.pagesConfig && aiSiteConfig.pagesConfig.length > 0) {
        // The AI hallucinates image URLs for sub-page heroes and content blocks,
        // which 404 on the live site (broken image boxes). It never returns real
        // images, so replace them with curated, known-good photos: per-page hero
        // uses the themed hero, and image blocks rotate through the product pool.
        type ContentBlock = { type?: string; image?: string; [k: string]: unknown };
        type PageConfig = {
          slug: string;
          title: string;
          hero?: { backgroundImage?: string; [k: string]: unknown };
          content_blocks?: ContentBlock[];
          [k: string]: unknown;
        };
        const sanitizedPages = (aiSiteConfig.pagesConfig as PageConfig[]).map((page, pIdx) => ({
          ...page,
          hero: { ...(page.hero || {}), backgroundImage },
          content_blocks: Array.isArray(page.content_blocks)
            ? page.content_blocks.map((block, bIdx) =>
                block.type === 'image_left' || block.type === 'image_right'
                  ? { ...block, image: pageImagePool[(pIdx + bIdx) % pageImagePool.length] }
                  : block
              )
            : page.content_blocks,
        }));
        (siteConfigData as Record<string, unknown>).pages_config = sanitizedPages;

        // Build the global navigation links automatically based on the AI's pages
        const navLinks = [{ label: 'Home', slug: '/' }];
        sanitizedPages.forEach((page) => {
          navLinks.push({ label: page.title, slug: page.slug });
        });
        (siteConfigData as Record<string, unknown>).nav_links = navLinks;
      }
    }

    const { error: configError } = await supabase.from('site_configs').insert(siteConfigData);

    if (configError) throw configError;
    } // end full-site-only block

    // 4b. Insert Widget Customizations if generated by AI (both modes).
    if (aiWidgetConfig) {
      const { customRooms, customAddOns, customFinishes } = aiWidgetConfig;
      
      // 1. Insert Custom Rooms
      if (customRooms && customRooms.length > 0) {
        const roomsToInsert = customRooms.map((r: { name: string; basic?: number; standard?: number; premium?: number }) => ({
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
        const addonsToInsert = customAddOns.map((a: { name: string; roomType?: string; price?: number }) => ({
          contractor_id: tenantId,
          name: a.name,
          room_type: a.roomType,
          price: a.price || 0
        }));
        await supabase.from('contractor_addons').insert(addonsToInsert);
      }

      // 3. Insert Custom Finishes
      if (customFinishes && customFinishes.length > 0) {
        const finishesToInsert = customFinishes.map((f: { label: string; description?: string; swatchHex?: string; tier?: string }, i: number) => ({
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

      // The base contractor_settings row already exists (created above). Here we
      // just disable the system defaults so the widget only shows the AI's
      // custom rooms/finishes.
      await supabase.from('contractor_settings').update({
        disabled_default_rooms: defaultRoomsToDisable,
        disabled_default_finishes: defaultFinishesToDisable
      }).eq('id', tenantId);
    }

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
    // Login lives on the dashboard origin (this API's own host), so derive it
    // from the request instead of hardcoding localhost.
    const loginUrl = `${new URL(req.url).origin}/login`;
    const siteUrl = `http://${subdomain}.localhost:3000`;
    const embedSnippet = widgetEmbedSnippet(widgetId);
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const productLine = isWidgetOnly
        ? `<p>Your Quote Calculator widget is ready to embed on your existing website. Paste this snippet where you want the calculator to appear:</p>
           <pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-all;">${embedSnippet.replace(/</g, '&lt;')}</pre>`
        : `<p>Your custom site has been provisioned and is currently pending admin approval.</p>`;

      await resend.emails.send({
        from: 'ClosetQuote <admin@closetquotes.com>',
        to: [ownerEmail],
        subject: isWidgetOnly
          ? `Your ClosetQuote Calculator is ready to embed`
          : `Welcome to ClosetQuote! Your site is pending approval.`,
        html: `
          <h1>Welcome, ${businessName}!</h1>
          ${productLine}
          <p>You can log in to your dashboard to manage your widget and settings.</p>
          <br/>
          <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
          <p><strong>Email:</strong> ${ownerEmail}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <br/>
          <p><em>Note: You will be required to change this password upon your first login.</em></p>
        `
      });
    }

    // Mark the originating prospect intake as built (best-effort; never blocks).
    if (intakeId) {
      try {
        await supabase
          .from('prospect_intakes')
          .update({ status: 'built', updated_at: new Date().toISOString() })
          .eq('id', intakeId);
      } catch (err) {
        console.error('Failed to mark intake built:', err);
      }
    }

    return NextResponse.json({ 
      success: true, 
      mode,
      // Hosted site URL for full builds; null for widget-only.
      url: isWidgetOnly ? null : siteUrl,
      // Widget identity + ready-to-paste embed snippet (used by Pipeline A).
      widgetId,
      embedSnippet,
      // Return the login credentials + URL so the operator can sign in even if
      // the Resend email fails (the email is the username).
      ownerEmail,
      loginUrl,
      tempPassword 
    });

  } catch (error) {
    console.error('Sandbox provision error:', error);
    // Supabase/Postgres errors are plain objects (not Error instances); surface
    // their message + details so failures aren't masked as a generic "Internal error".
    let message = 'Internal error';
    if (error instanceof Error) {
      message = error.message;
    } else if (error && typeof error === 'object') {
      const e = error as { message?: string; details?: string; code?: string };
      message = [e.message, e.details, e.code && `(${e.code})`].filter(Boolean).join(' ') || 'Internal error';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
