import { NextResponse } from 'next/server'
import { generateTextForPurpose } from '@/lib/ai/aiTextProvider'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { assertDraftIntake, assertDepositPaid } from '@/lib/intake/intakeTierGates'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { buildIntakeBrief, stripUneditedCraftSuggestions } from '@/lib/intake/buildIntakeBrief'
import { SITE_PAGE_OPTIONS, clampPagesForTier } from '@/lib/catalog/sitePages'
import { OTHER_SERVICE_LABEL } from '@/lib/catalog/contractorServices'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { DESIGN_CRAFT_PERSONA } from '@/lib/ai/craftStandards'
import { HUMAN_COPY_VOICE_RULES } from '@/lib/ai/humanCopyVoice'
import { generateWithQualityRetry } from '@/lib/ai/generateWithQualityRetry'
import { validateGeneratedUnits } from '@/lib/validation/generatedContentQuality'
import { enqueueIntakeGeneration, isOracleExecution } from '@/lib/jobs/intakeGeneration'

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
    const { text: primaryText } = await generateTextForPurpose('intake_page_copy', {
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
      const { text: fallbackText } = await generateTextForPurpose('intake_page_copy', {
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
      // Fabricating testimonials is banned platform-wide. This directive only
      // runs when the brief contains a REAL CUSTOMER QUOTES block (the route
      // refuses the slug otherwise).
      return `Write a Reviews & Testimonials page for "${label}". Write a short intro paragraph, then present ONLY the quotes from the REAL CUSTOMER QUOTES block in the brief, verbatim. Never invent, extend, or paraphrase a quote, and never add names, ratings, or details that are not in the block. If a quote has no attribution, present it unattributed.`
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

async function executeIntakeGeneratePageCopy(
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

    let body: Record<string, unknown> = {}
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

    // Testimonials are never fabricated. Without owner-supplied quotes the
    // page cannot exist, so refuse before spending a model call.
    if (slug === 'testimonials') {
      const quotes =
        typeof body?.customerQuotes === 'string' && body.customerQuotes.trim()
          ? body.customerQuotes.trim()
          : row.customer_quotes?.trim() || ''
      if (!quotes) {
        return NextResponse.json(
          {
            error:
              'The Reviews & Testimonials page is built only from your real customer quotes. Paste a few quotes (one per line) in the testimonials field first — we never invent reviews.',
          },
          { status: 400 }
        )
      }
    }

    // Update draft fields in database so the generated brief is based on the user's latest inputs
    const toStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const toArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

    const update: Record<string, unknown> = {
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
    if (body.includeQuiz !== undefined) {
      update.include_quiz = body.includeQuiz === true
    }
    if (body.notes !== undefined) update.notes = toStr(body.notes)
    if (body.customerQuotes !== undefined) update.customer_quotes = toStr(body.customerQuotes)
    
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

    // Craft answers kept verbatim from AI suggestions are examples, not facts
    // — exclude them so they never become "proof" in generated copy.
    stripUneditedCraftSuggestions(row as Record<string, unknown>, body.craftSuggestedFields)

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

${DESIGN_CRAFT_PERSONA}

${HUMAN_COPY_VOICE_RULES}

RULES:
- Maximum 1200 words. Aim for 400-800 words of rich, persuasive content.
- Match the brand tone from the brief (e.g. luxury, friendly, bold).
- Use the business name, services, differentiators, and location from the brief.
- Write in plain text paragraphs. Use line breaks between paragraphs.
- Do NOT use markdown formatting, HTML tags, or bullet points.
- Do NOT include page titles or headings — just the body copy.
- Every sentence must deliver value — no padding, no filler.
- Reference specific services, materials, and locations from the brief.
- Never invent testimonials, reviews, ratings, statistics, awards, or named customers. Concrete claims must come from the brief.
- End with a natural call-to-action relevant to the page.

PAGE: ${label}
PAGE PURPOSE: ${desc}

${directive}

Return ONLY valid JSON: { "content": "the page body copy here" }

Business Brief:
${brief}`

    const initialContent = await generatePageCopy(prompt)

    // Validate against the shared copy gate and retry with violation feedback,
    // so this surface is held to the same bar as full-redesign generation.
    const result = await generateWithQualityRetry<{ content: string }>({
      initial: { content: initialContent },
      validate: (output) => {
        const report = validateGeneratedUnits({
          stage: 'intake_page_copy',
          units: [{ id: 'content', text: output.content, sourceText: brief }],
          businessName: row.business_name,
          locality: row.address_locality || row.service_area,
        })
        return {
          status: report.status,
          findings: report.findings.map((f) => ({
            unitId: f.unitId,
            code: f.code,
            message: f.message,
            samples: f.samples,
          })),
          failedUnitIds: report.failedUnitIds,
        }
      },
      regenerate: async ({ findings }) => {
        const feedback = findings
          .map((f, i) => `${i + 1}. ${f.message}${f.samples.length ? ` Offending: ${f.samples.join(', ')}` : ''}`)
          .join('\n')
        const retryPrompt = `${prompt}\n\nYour previous draft failed the copy quality gate. Fix EVERY violation below and return the full corrected page body:\n${feedback}`
        return { content: await generatePageCopy(retryPrompt) }
      },
      maxRetries: 2,
    })

    const content = result.output.content

    // Enforce 1200-word cap
    const words = content.split(/\s+/).filter(Boolean)
    const capped = words.length > 1200 ? words.slice(0, 1200).join(' ') : content

    // A still-failing report does not block here (enforcement bites at the
    // provisioning gate for new tenants); it is surfaced so the intake UI and
    // logs can show what the admin will have to fix.
    return NextResponse.json({
      success: true,
      content: capped,
      slug,
      quality: result.status,
      qualityFindings: result.status === 'failed' ? result.report.findings : [],
    })
  } catch (error) {
    console.error('generate-page-copy error:', error)
    const message =
      error instanceof Error ? error.message : 'Copy generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (isOracleExecution(req)) {
    return executeIntakeGeneratePageCopy(req, { params: Promise.resolve({ token }) })
  }
  return enqueueIntakeGeneration(req, token, 'generate-page-copy')
}
