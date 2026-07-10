import { NextResponse } from 'next/server'
import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { assertDraftIntake, assertDepositPaid } from '@/lib/intake/intakeTierGates'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { buildIntakeBrief } from '@/lib/intake/buildIntakeBrief'
import { SITE_PAGE_OPTIONS, clampPagesForTier } from '@/lib/catalog/sitePages'
import { OTHER_SERVICE_LABEL } from '@/lib/catalog/contractorServices'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

function sanitizeJsonString(json: string): string {
  let insideString = false
  let escaped = false
  let result = ''
  for (let i = 0; i < json.length; i++) {
    const char = json[i]
    if (char === '"' && !escaped) {
      insideString = !insideString
      result += char
    } else if (char === '\\' && insideString && !escaped) {
      escaped = true
      result += char
    } else {
      if (insideString) {
        if (char === '\n') {
          result += '\\n'
        } else if (char === '\r') {
          result += '\\r'
        } else if (char === '\t') {
          result += '\\t'
        } else if (char.charCodeAt(0) < 32) {
          result += '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')
        } else {
          result += char
        }
      } else {
        result += char
      }
      escaped = false
    }
  }
  return result
}

export const maxDuration = 30
export const runtime = 'nodejs'

const VALID_SLUGS = new Set(SITE_PAGE_OPTIONS.map((p) => p.slug))
const SLUG_TO_LABEL = new Map(SITE_PAGE_OPTIONS.map((p) => [p.slug, p.label]))
const SLUG_TO_DESC = new Map(SITE_PAGE_OPTIONS.map((p) => [p.slug, p.description]))

function parseJsonContent(rawText: string): string {
  const parsed = JSON.parse(sanitizeJsonString(extractJson(rawText))) as { content?: string }
  return (parsed.content || '').trim()
}

function parsePlainTextContent(rawText: string): string {
  return rawText
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function generatePageCopy(prompt: string): Promise<string> {
  // Primary path: structured JSON output via unified fallback provider
  try {
    const { text: primaryText } = await generateTextWithFallback({
      prompt,
      jsonMode: true,
      temperature: 0.75,
      maxOutputTokens: 4096,
    })
    const content = parseJsonContent(primaryText)
    if (content) return content
    throw new Error('AI returned empty JSON content')
  } catch (error) {
    console.error('generatePageCopy JSON mode failed:', error)
    // Fallback path: plain text output via unified fallback provider
    const fallbackPrompt =
      `${prompt}\n\n` +
      'Fallback mode: if JSON output is unavailable, return only raw page body text (no JSON, no markdown, no headings).'

    try {
      const { text: fallbackText } = await generateTextWithFallback({
        prompt: fallbackPrompt,
        jsonMode: false,
        temperature: 0.75,
        maxOutputTokens: 4096,
      })
      const content = parsePlainTextContent(fallbackText)
      if (!content) {
        throw new Error('AI returned empty content')
      }
      return content
    } catch (fallbackError) {
      console.error('generatePageCopy fallback mode also failed:', fallbackError)
      throw fallbackError
    }
  }
}

/** Page-type-specific writing instructions for the AI. */
function pageDirective(slug: string, label: string): string {
  switch (slug) {
    case 'about':
      return `Write a compelling About Us page for "${label}". Tell the brand's story: who they are, how they started, what drives their craftsmanship, and why customers trust them. Weave in differentiators and experience level from the brief. End with a warm invitation to reach out.`
    case 'services':
      return `Write a Services page for "${label}". Open with a confident intro about the range of services. Then dedicate a paragraph to each service the business offers (from the brief). Highlight materials, process, and outcome for each. Close with a CTA.`
    case 'portfolio':
      return `Write a Portfolio / Gallery page for "${label}". Open with a brief intro celebrating the team's craftsmanship and attention to detail. Describe the types of projects showcased (based on the services in the brief). End with an invitation to see more or start a project.`
    case 'process':
      return `Write an Our Process page for "${label}". Walk the reader through how the business works — from initial consultation, through design, to installation. Make each step feel premium and reassuring. Use the brief's tone and vibe.`
    case 'testimonials':
      return `Write a Reviews & Testimonials page for "${label}". Create an intro paragraph about why clients love working with them. Then write 4-6 realistic, specific testimonial quotes from satisfied customers (with first-name attribution). Each should mention a specific service or outcome.`
    case 'financing':
      return `Write a Financing page for "${label}". Explain that premium storage solutions are an investment. Describe flexible payment options. Address common concerns about cost. Use the pricing notes from the brief if available. Keep it reassuring and professional.`
    case 'faq':
      return `Write an FAQ page for "${label}". Create 6-8 common questions and detailed answers. Cover: timeline, cost ranges, materials, warranty, process, service area, and customization options. Use information from the brief to make answers specific.`
    case 'service-areas':
      return `Write a Service Areas page for "${label}". Open with an intro about the regions they serve. Use the service area from the brief. Create compelling paragraphs about why local customers choose them. Mention specific neighborhoods or regions if the brief provides them.`
    case 'contact':
      return `Write a Contact page for "${label}". Create a warm, inviting intro encouraging visitors to reach out. Mention the various ways to get in touch. Include a compelling paragraph about what happens after they reach out (consultation, quote, etc.). End with reassurance about response time.`
    default:
      return `Write compelling website copy for the "${label}" page. Use information from the business brief to create specific, persuasive content. Match the brand's tone and vibe.`
  }
}

function extractJson(text: string): string {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const firstObj = t.indexOf('{')
  const lastObj = t.lastIndexOf('}')
  if (firstObj !== -1 && lastObj > firstObj) return t.slice(firstObj, lastObj + 1)
  return t
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'API keys are not configured.' },
        { status: 500 }
      )
    }

    const { token } = await params

    const row = await getIntakeByToken(token)
    if (!row) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    const draftErr = assertDraftIntake(row)
    if (draftErr) {
      return NextResponse.json({ error: draftErr }, { status: 410 })
    }

    const depositErr = assertDepositPaid(row)
    if (depositErr) {
      return NextResponse.json({ error: depositErr }, { status: 403 })
    }

    const limit = await checkRateLimit(
      hashRateKey('intake_page_copy', token),
      20,
      24 * 60 * 60 * 1000
    )
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many page-copy generations today. Try again tomorrow.' },
        { status: 429 }
      )
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      // Empty body
    }

    const slug = typeof body?.slug === 'string' ? body.slug.trim() : ''
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid page slug.' },
        { status: 400 }
      )
    }

    // Update draft fields in database so the generated brief is based on the user's latest inputs
    const toStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const toArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (body.businessName !== undefined) update.business_name = toStr(body.businessName)
    if (body.industry !== undefined) update.industry = toStr(body.industry)
    if (body.contactName !== undefined) update.contact_name = toStr(body.contactName)
    if (body.contactEmail !== undefined) update.contact_email = toStr(body.contactEmail)
    if (body.contactPhone !== undefined) update.contact_phone = toStr(body.contactPhone)
    if (body.streetAddress !== undefined) update.street_address = toStr(body.streetAddress)
    if (body.addressLocality !== undefined) update.address_locality = toStr(body.addressLocality)
    if (body.addressRegion !== undefined) update.address_region = toStr(body.addressRegion)
    if (body.postalCode !== undefined) update.postal_code = toStr(body.postalCode)
    if (body.serviceArea !== undefined) update.service_area = toStr(body.serviceArea)
    if (body.notificationEmail !== undefined) update.notification_email = toStr(body.notificationEmail)
    if (body.notificationPhone !== undefined) update.notification_phone = toStr(body.notificationPhone)
    
    if (body.services !== undefined) {
      const services = toArr(body.services)
      update.services = services
      if (body.otherServices !== undefined) {
        const hasOther = services.includes(OTHER_SERVICE_LABEL)
        update.other_services = hasOther ? toStr(body.otherServices) : null
      }
    }
    
    if (body.pricingNotes !== undefined) update.pricing_notes = toStr(body.pricingNotes)
    if (body.primaryColorHex !== undefined) update.primary_color_hex = toStr(body.primaryColorHex)
    if (body.vibe !== undefined) update.vibe = toStr(body.vibe)
    if (body.tone !== undefined) update.tone = toStr(body.tone)
    if (body.customers !== undefined) update.customers = toStr(body.customers)
    if (body.experience !== undefined) update.experience = toStr(body.experience)
    if (body.differentiators !== undefined) update.differentiators = toArr(body.differentiators)
    if (body.primaryCta !== undefined) update.primary_cta = toStr(body.primaryCta)
    if (body.desiredDomain !== undefined) update.desired_domain = toStr(body.desiredDomain)
    if (body.domainPurchaseRequested !== undefined) {
      update.domain_purchase_requested = body.domainPurchaseRequested === true
    }
    if (body.notes !== undefined) update.notes = toStr(body.notes)
    
    if (body.pages !== undefined) {
      update.requested_pages = clampPagesForTier(
        body.pages,
        row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard'
      )
    }

    if (Object.keys(update).length > 1) {
      const admin = getSupabaseAdmin()
      const { error: updateErr } = await admin
        .from('prospect_intakes')
        .update(update)
        .eq('id', row.id)
      
      if (updateErr) {
        console.error('Error updating draft intake in generate-page-copy:', updateErr)
      } else {
        Object.assign(row, update)
      }
    }

    const brief = buildIntakeBrief(row)
    if (!brief.trim()) {
      return NextResponse.json(
        { error: 'Fill in business details before generating copy.' },
        { status: 400 }
      )
    }

    const label = SLUG_TO_LABEL.get(slug) || slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const desc = SLUG_TO_DESC.get(slug) || `Detailed information about ${label.toLowerCase()}`
    const directive = pageDirective(slug, label)

    const prompt = `System: You are an elite direct-response copywriter specializing in high-converting websites for local service businesses and contractors across any trade (e.g. plumbing, towing, HVAC, electrical, landscaping, custom closets & storage). Infer the specific trade from the business brief.

Your job is to write the body copy for a single page of a contractor's website. The copy must be SPECIFIC to this exact business — never generic filler. Write like a $200k creative agency.

RULES:
- Maximum 1200 words. Aim for 400-800 words of rich, persuasive content.
- Match the brand tone from the brief (e.g. luxury, friendly, bold).
- Use the business name, services, differentiators, and location from the brief.
- Write in plain text paragraphs. Use line breaks between paragraphs.
- Do NOT use markdown formatting, HTML tags, or bullet points.
- Do NOT include page titles or headings — just the body copy.
- Every sentence must deliver value — no padding, no filler.
- Reference specific services, materials, and locations from the brief.
- End with a natural call-to-action relevant to the page.

PAGE: ${label}
PAGE PURPOSE: ${desc}

${directive}

Return ONLY valid JSON: { "content": "the page body copy here" }

Business Brief:
${brief}`

    const content = await generatePageCopy(prompt)

    // Enforce 1200-word cap
    const words = content.split(/\s+/).filter(Boolean)
    const capped = words.length > 1200 ? words.slice(0, 1200).join(' ') : content

    return NextResponse.json({ success: true, content: capped, slug })
  } catch (error) {
    console.error('generate-page-copy error:', error)
    const message =
      error instanceof Error ? error.message : 'Copy generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
