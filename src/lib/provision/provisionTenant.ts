import { v4 as uuidv4 } from 'uuid'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { widgetEmbedSnippet } from '@/lib/urls'
import { normalizeDomain, attachVercelDomain } from '@/lib/vercel-domains'
import {
  type ProvisionTenantInput,
  type ProvisionTenantResult,
  ProvisionReviewError,
} from '@/lib/provision/types'

function generateTempPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export async function provisionTenant(
  body: ProvisionTenantInput
): Promise<ProvisionTenantResult> {
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
    intakeSetup,
    intakeId,
    loginOrigin,
    sendWelcomeEmail = true,
  } = body

  const setup = intakeSetup || {}
  const mode: 'full' | 'widget' = body.mode === 'widget' ? 'widget' : 'full'
  const isWidgetOnly = mode === 'widget'

  const missingRequired = isWidgetOnly
    ? !businessName || !ownerEmail
    : !businessName || !theme || !subdomain || !ownerEmail
  if (missingRequired) {
    throw new Error('Missing required fields')
  }

  const supabase = getSupabaseAdmin()

  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_email', ownerEmail)
    .maybeSingle()
  if (existingTenant) {
    throw new ProvisionReviewError(`Owner email already provisioned: ${ownerEmail}`)
  }

  const tenantId = body.tenantId || uuidv4()
  const widgetId = tenantId

  const siteStatus =
    body.siteStatus ??
    (isWidgetOnly ? 'widget_only' : 'pending_approval')

  const settingsRow: Record<string, unknown> = {
    id: tenantId,
    company_name: businessName,
    contact_email: ownerEmail,
  }
  const leadEmail = setup.notificationEmail || setup.contactEmail
  const leadPhone = setup.notificationPhone || setup.contactPhone
  if (leadEmail) settingsRow.contact_email = leadEmail
  if (leadPhone) settingsRow.contact_phone = leadPhone
  if (setup.primaryColorHex) settingsRow.primary_color_hex = setup.primaryColorHex

  const { error: settingsError } = await supabase
    .from('contractor_settings')
    .upsert(settingsRow)
  if (settingsError) throw settingsError

  const { error: tenantError } = await supabase.from('tenants').insert({
    id: tenantId,
    business_name: businessName,
    owner_email: ownerEmail,
    widget_id: widgetId,
    subscription_status: 'active',
    site_status: siteStatus,
  })
  if (tenantError) throw tenantError

  let siteUrl: string | null = null
  let domainResult: ProvisionTenantResult['domain'] = null

  if (!isWidgetOnly) {
    const baseDomain = (process.env.TENANT_BASE_DOMAIN || 'localhost').replace(/^\.+|\.+$/g, '')
    const isLocalBase = baseDomain === 'localhost' || baseDomain.endsWith('.localhost')
    const platformHost = `${subdomain}.${baseDomain}`
    const customHost = normalizeDomain(setup.desiredDomain)

    const { error: domainError } = await supabase.from('domains').insert({
      tenant_id: tenantId,
      hostname: platformHost,
      is_primary: !customHost,
      ssl_status: 'active',
    })
    if (domainError) throw domainError

    domainResult = { platformHost, customHost: null, vercel: null }

    if (customHost) {
      const { error: customDomainError } = await supabase.from('domains').insert({
        tenant_id: tenantId,
        hostname: customHost,
        is_primary: true,
        ssl_status: 'pending',
      })
      if (customDomainError) {
        console.error('Custom domain insert failed:', customDomainError)
        await supabase
          .from('domains')
          .update({ is_primary: true })
          .eq('tenant_id', tenantId)
          .eq('hostname', platformHost)
      } else {
        domainResult.customHost = customHost
        if (!isLocalBase) {
          domainResult.vercel = await attachVercelDomain(customHost)
        }
      }
    }

    const primaryHost = domainResult.customHost || domainResult.platformHost
    siteUrl = isLocalBase ? `http://${primaryHost}:3000` : `https://${primaryHost}`

    const serviceCatalog: Record<string, { image: string; description: string }> = {
      'Walk-In Closets': {
        image: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
        description: 'Luxurious walk-in spaces designed for your lifestyle.',
      },
      'Reach-In Closets': {
        image: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
        description: 'Maximize every inch with precision reach-in designs.',
      },
      Garages: {
        image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
        description: 'High-performance garage environments built to last.',
      },
      'Pantries & Wine': {
        image: 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
        description: 'Elegant storage for culinary and wine collections.',
      },
      'Home Offices': {
        image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
        description: 'Productive and beautifully organized workspaces.',
      },
      Mudrooms: {
        image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
        description: 'Seamless entryways that handle daily chaos.',
      },
      'Wall Beds': {
        image: 'https://images.unsplash.com/photo-1505693314120-0d443867891c',
        description: 'Transformative sleep solutions for multi-use rooms.',
      },
      'Entertainment Centers': {
        image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
        description: 'Sleek media walls for the ultimate viewing experience.',
      },
    }

    const GENERIC_HERO = 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1'
    const THEME_HERO_IMAGES: Record<string, string> = {
      'luxury-minimal': GENERIC_HERO,
      brutalist: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
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
      'minimalist-zen': GENERIC_HERO,
    }
    const PRODUCT_IMAGE_POOL = [
      'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
      'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
      'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
      'https://images.unsplash.com/photo-1556910103-1c02745a872f',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
      'https://images.unsplash.com/photo-1505693314120-0d443867891c',
      'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
    ]

    const selectedServices =
      services && services.length > 0 ? services : ['Walk-In Closets']

    let siteConfigData: Record<string, unknown> = {
      tenant_id: tenantId,
      brand_name: businessName,
      theme: theme!,
      layout_style: layoutStyle || 'standard',
      default_room: 'Custom Space',
      logo_url: setup.logoUrl || null,
      pricing_notes: setup.pricingNotes || null,
      hero_config: {
        headline: heroHeadline || `Welcome to ${businessName}`,
        backgroundImage:
          heroImage && heroImage !== GENERIC_HERO
            ? heroImage
            : THEME_HERO_IMAGES[theme!] || GENERIC_HERO,
      },
      about_config: {
        description:
          aboutDescription ||
          `${businessName} provides premium custom storage solutions tailored to your life.`,
      },
      process_config: {
        title: 'Our Process',
        subtitle: 'How we work',
        steps: [
          { number: '01', title: 'Consultation', description: 'We meet with you.' },
          { number: '02', title: 'Design', description: 'We design it.' },
          { number: '03', title: 'Install', description: 'We build it.' },
        ],
      },
      products_config: selectedServices.map((serviceName: string) => {
        const catalogItem = serviceCatalog[serviceName] || {
          image: GENERIC_HERO,
          description: 'Premium custom storage solution.',
        }
        return {
          title: serviceName,
          image: catalogItem.image,
          description: catalogItem.description,
          details: {
            subtitle: 'Bespoke Design',
            longDescription: `Full architectural build out for your ${serviceName}.`,
            specifications: ['Premium Materials', 'Precision Fit', 'Lifetime Warranty'],
          },
        }
      }),
      seo_config: {
        legalName: businessName,
        phone: setup.contactPhone || '555-0199',
        streetAddress: setup.streetAddress || '123 Main St',
        addressLocality: setup.addressLocality || setup.serviceArea || 'Anytown',
        addressRegion: setup.addressRegion || 'NY',
        postalCode: setup.postalCode || '10001',
        geo: { latitude: '40.7128', longitude: '-74.0060' },
      },
      before_after_config: {
        beforeImage: beforeImage || '/brands/lumina/before.png',
        afterImage: heroImage || '/brands/lumina/hero.png',
        title: `The ${businessName} Transformation`,
        subtitle: 'Drag to see',
      },
    }

    if (aiSiteConfig) {
      const finalTheme = theme || (aiSiteConfig.theme as string)
      const operatorHero =
        heroImage && heroImage !== GENERIC_HERO ? heroImage : null
      const backgroundImage =
        operatorHero || THEME_HERO_IMAGES[finalTheme] || GENERIC_HERO
      const aiProducts = Array.isArray(aiSiteConfig.products)
        ? aiSiteConfig.products
        : null
      const productsWithImages = (
        aiProducts ?? (siteConfigData.products_config as unknown[])
      ).map(
        (
          p: {
            title?: string
            image?: string
            imagePrompt?: string
            [k: string]: unknown
          },
          i: number
        ) => {
          const { imagePrompt: _imagePrompt, ...rest } = p
          void _imagePrompt
          return {
            ...rest,
            image:
              p.image ||
              (p.title && serviceCatalog[p.title]?.image) ||
              PRODUCT_IMAGE_POOL[i % PRODUCT_IMAGE_POOL.length],
          }
        }
      )

      siteConfigData = {
        ...siteConfigData,
        theme: finalTheme,
        default_room: (aiSiteConfig.defaultRoom as string) || siteConfigData.default_room,
        hero_config: {
          headline:
            (aiSiteConfig.hero as { headline?: string })?.headline ||
            (siteConfigData.hero_config as { headline: string }).headline,
          backgroundImage,
        },
        about_config: aiSiteConfig.about || siteConfigData.about_config,
        process_config: aiSiteConfig.process || siteConfigData.process_config,
        products_config: productsWithImages,
      }

      siteConfigData.before_after_config = {
        ...(siteConfigData.before_after_config as object),
        afterImage: backgroundImage,
      }

      if (aiSiteConfig.pagesConfig && Array.isArray(aiSiteConfig.pagesConfig)) {
        const pageImagePool = productsWithImages
          .map((p: { image?: string }) => p.image)
          .filter(Boolean) as string[]
        const pool = pageImagePool.length > 0 ? pageImagePool : PRODUCT_IMAGE_POOL
        type PageConfig = {
          slug: string
          title: string
          hero?: Record<string, unknown>
          content_blocks?: Array<{ type?: string; image?: string }>
        }
        const sanitizedPages = (aiSiteConfig.pagesConfig as PageConfig[]).map(
          (page, pIdx) => ({
            ...page,
            hero: { ...(page.hero || {}), backgroundImage },
            content_blocks: Array.isArray(page.content_blocks)
              ? page.content_blocks.map((block, bIdx) =>
                  block.type === 'image_left' || block.type === 'image_right'
                    ? {
                        ...block,
                        image: pool[(pIdx + bIdx) % pool.length],
                      }
                    : block
                )
              : page.content_blocks,
          })
        )
        siteConfigData.pages_config = sanitizedPages
        const navLinks = [{ label: 'Home', slug: '/' }]
        sanitizedPages.forEach((page) => {
          navLinks.push({ label: page.title, slug: page.slug })
        })
        siteConfigData.nav_links = navLinks
      }
    }

    const { error: configError } = await supabase.from('site_configs').insert(siteConfigData)
    if (configError) throw configError
  }

  if (aiWidgetConfig) {
    const { customRooms, customAddOns, customFinishes } = aiWidgetConfig as {
      customRooms?: Array<{ name: string; basic?: number; standard?: number; premium?: number }>
      customAddOns?: Array<{ name: string; roomType?: string; price?: number }>
      customFinishes?: Array<{
        label: string
        description?: string
        swatchHex?: string
        tier?: string
      }>
    }

    if (customRooms?.length) {
      await supabase.from('contractor_rooms').insert(
        customRooms.map((r) => ({
          contractor_id: tenantId,
          name: r.name,
          price_basic: r.basic || 0,
          price_standard: r.standard || 0,
          price_premium: r.premium || 0,
        }))
      )
    }
    if (customAddOns?.length) {
      await supabase.from('contractor_addons').insert(
        customAddOns.map((a) => ({
          contractor_id: tenantId,
          name: a.name,
          room_type: a.roomType,
          price: a.price || 0,
        }))
      )
    }
    if (customFinishes?.length) {
      await supabase.from('contractor_finishes').insert(
        customFinishes.map((f, i) => ({
          contractor_id: tenantId,
          label: f.label,
          description: f.description,
          swatch_hex: f.swatchHex || '#cccccc',
          tier: f.tier || 'basic',
          sort_order: i,
        }))
      )
    }

    await supabase
      .from('contractor_settings')
      .update({
        disabled_default_rooms: [
          'Walk-In Closet',
          'Reach-In Closet',
          'Garage',
          'Pantry & Wine',
          'Home Office',
          'Laundry Room',
          'Mudroom',
          'Entertainment Center',
          'Wall Beds',
          'Craft Room',
          'Home Library',
          'Kid Spaces',
          'Dressing Room',
          'Home Storage',
        ],
        disabled_default_finishes: ['basic', 'standard', 'premium'],
      })
      .eq('id', tenantId)
  }

  const tempPassword = generateTempPassword()
  let authUserId: string | null = null

  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers.users.find((u) => u.email === ownerEmail)

  if (!existingUser) {
    const { data: created, error: authError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        force_password_reset: true,
        tenant_id: tenantId,
        widget_id: widgetId,
      },
    })
    if (authError) console.error('Failed to create auth user:', authError)
    else authUserId = created.user?.id ?? null
  } else {
    authUserId = existingUser.id
    await supabase.auth.admin.updateUserById(existingUser.id, {
      password: tempPassword,
      user_metadata: {
        force_password_reset: true,
        tenant_id: tenantId,
        widget_id: widgetId,
      },
    })
  }

  if (authUserId) {
    await supabase
      .from('contractor_settings')
      .update({ user_id: authUserId, contact_email: ownerEmail })
      .eq('id', tenantId)
  }

  const loginUrl = `${loginOrigin.replace(/\/$/, '')}/login`
  const embedSnippet = widgetEmbedSnippet(widgetId)

  if (sendWelcomeEmail && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const pendingSite = !isWidgetOnly && siteStatus === 'pending_approval'
    const productLine = isWidgetOnly
      ? `<p>Your Quote Calculator widget is ready to embed on your existing website. Paste this snippet where you want the calculator to appear:</p>
         <pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-all;">${embedSnippet.replace(/</g, '&lt;')}</pre>`
      : pendingSite
        ? `<p>Your custom site has been provisioned and is pending admin approval. We will notify you when it is live.</p>`
        : `<p>Your custom site is live.</p>`

    await resend.emails.send({
      from: process.env.INTAKE_FROM_EMAIL || 'ClosetQuote <admin@closetquotes.com>',
      to: [ownerEmail],
      subject: isWidgetOnly
        ? 'Your ClosetQuote Calculator is ready to embed'
        : pendingSite
          ? 'Welcome to ClosetQuote! Your site is pending approval.'
          : 'Welcome to ClosetQuote!',
      html: `
        <h1>Welcome, ${businessName}!</h1>
        ${productLine}
        <p>You can log in to your dashboard to manage your widget and settings.</p>
        <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
        <p><strong>Email:</strong> ${ownerEmail}</p>
        <p><strong>Temporary Password:</strong> ${tempPassword}</p>
        <p><em>Note: You will be required to change this password upon your first login.</em></p>
      `,
    })
  }

  if (intakeId) {
    try {
      await supabase
        .from('prospect_intakes')
        .update({ status: 'built', updated_at: new Date().toISOString() })
        .eq('id', intakeId)
    } catch (err) {
      console.error('Failed to mark intake built:', err)
    }
  }

  return {
    success: true,
    mode,
    tenantId,
    widgetId,
    url: isWidgetOnly ? null : siteUrl,
    domain: domainResult,
    embedSnippet,
    ownerEmail,
    loginUrl,
    tempPassword,
    authUserId,
  }
}
