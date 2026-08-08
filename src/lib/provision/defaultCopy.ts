import { hashSeed } from '@/lib/catalog/designFingerprint'

/**
 * Shared provision fallbacks that avoid AI/template tells
 * ("Welcome to…", "Custom Space", identical spec trilogies).
 */

export function buildFallbackHeadline(opts: {
  businessName: string
  primaryService?: string
  serviceArea?: string
  locality?: string
}): string {
  const brand = (opts.businessName || '').trim() || 'Our Studio'
  const service = (opts.primaryService || '').trim()
  const place = (opts.serviceArea || opts.locality || '').trim()
  if (service && place) return `${service} in ${place}`
  if (service) return `${service} by ${brand}`
  if (place) return `${brand} in ${place}`
  return brand
}

export function defaultRoomForEngagement(engagementModel: string): string {
  switch ((engagementModel || 'quote').toLowerCase()) {
    case 'order':
      return 'your order'
    case 'booking':
      return 'your appointment'
    case 'ticket':
      return 'your visit'
    default:
      return 'your project'
  }
}

/**
 * Fallback spec lists when intake provided no differentiators. Seeded variants
 * of two or four items — never three, because the identical rule-of-three trio
 * on every card is itself a template tell.
 */
export function defaultProductSpecs(
  engagementModel: string,
  serviceName: string,
  differentiators?: string[] | null,
  seed = ''
): string[] {
  const fromIntake = (differentiators || [])
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, 4)
  if (fromIntake.length > 0) return fromIntake

  const svc = serviceName.trim() || 'this service'
  const eng = (engagementModel || 'quote').toLowerCase()
  const pools: Record<string, string[][]> = {
    order: [
      ['Made when you order', 'Priced on the menu, no surprises'],
      ['Prepared in-house', 'Order ahead for pickup', 'Substitutions welcome', 'Same price online as in person'],
      ['Portioned to order', 'Ready-time quoted at checkout'],
    ],
    booking: [
      ['Pick your own time slot', 'Reminder before your appointment'],
      ['Booked to the half hour', 'Confirmation by text', 'Reschedule up to a day ahead', 'Same person start to finish'],
      ['Arrival window confirmed in advance', 'No charge to rebook'],
    ],
    ticket: [
      ['Diagnosis before any charge', 'You approve the fix first'],
      ['Same-week response', 'Written findings', 'Repair options priced separately', 'Follow-up included'],
      ['One point of contact per request', 'Status updates until closed'],
    ],
    quote: [
      [`Scope for ${svc} in writing first`, 'Price fixed before work starts'],
      ['Walkthrough before quoting', 'Itemized pricing', 'Start date set at signing', 'Punch-list check at the end'],
      [`${svc} measured on site, not guessed`, 'Change orders priced before proceeding'],
    ],
  }
  const pool = pools[eng] || pools.quote
  return pool[hashSeed(`${seed}:${svc}:specs:${eng}`) % pool.length]
}

// ── Lightweight vertical hint for copy selection ────────────────────────────
type CopyVertical = 'medical' | 'general'

function detectCopyVertical(industrySlug?: string | null): CopyVertical {
  const slug = (industrySlug || '').toLowerCase()
  if (/medical|therapy|rehab|senior|clinic|dental|hospital/.test(slug)) return 'medical'
  return 'general'
}

export function buildDefaultAbout(
  businessName: string,
  primaryService: string,
  serviceArea: string | undefined,
  seed: string,
  industrySlug?: string | null
): { description: string } {
  const svc = (primaryService || 'quality work').toLowerCase()
  const area = serviceArea?.trim() || 'the areas we serve'
  const vertical = detectCopyVertical(industrySlug)

  if (vertical === 'medical') {
    const medicalVariants = [
      `${businessName} sees patients across ${area}. Appointments run on schedule, your questions get answered in plain language, and follow-up instructions leave with you in writing.`,
      `Across ${area}, ${businessName} handles ${svc} with the same clinician from intake through follow-up, so nothing gets repeated or lost between visits.`,
      `${businessName} keeps ${svc} straightforward: clear scheduling, direct answers about treatment and cost, and a real person on the phone for follow-ups.`,
    ]
    return { description: medicalVariants[hashSeed(`${seed}:about`) % medicalVariants.length] }
  }

  const variants = [
    `${businessName} delivers dependable ${svc} across ${area}. We treat every job with care and respect for your property, and we stand behind the result.`,
    `Across ${area}, ${businessName} is known for straightforward ${svc}. You get clear expectations, fair pricing, and work that holds up.`,
    `${businessName} focuses on reliable ${svc} with honest communication from the first call through the final walkthrough.`,
  ]
  return { description: variants[hashSeed(`${seed}:about`) % variants.length] }
}

/** Seeded before/after slider copy. No brand-name formula, no em dash. */
export function buildDefaultBeforeAfterCopy(seed: string): { title: string; subtitle: string } {
  const titles = [
    'Before and after',
    'The same space, before and after',
    'Same room, different layout',
    'What changed here',
    'Side by side',
  ]
  const subtitles = [
    'Slide to compare',
    'Drag the handle to compare',
    'Move the slider to see the change',
    'Pull the divider across',
  ]
  return {
    title: titles[hashSeed(`${seed}:ba:title`) % titles.length],
    subtitle: subtitles[hashSeed(`${seed}:ba:subtitle`) % subtitles.length],
  }
}

type ProcessConfig = {
  title: string
  subtitle: string
  steps: Array<{ number: string; title: string; description: string }>
}

export function buildDefaultProcess(
  engagementModel: string,
  primaryService: string,
  seed: string,
  industrySlug?: string | null
): ProcessConfig {
  const svc = (primaryService || 'the work').toLowerCase()
  const vertical = detectCopyVertical(industrySlug)

  // Medical booking gets dedicated healthcare-appropriate steps
  if (vertical === 'medical' && (engagementModel || 'quote').toLowerCase() === 'booking') {
    const medicalBooking: ProcessConfig[] = [
      {
        title: 'How It Works',
        subtitle: 'From appointment to care',
        steps: [
          { number: '01', title: 'Schedule', description: 'Request an appointment online or by phone. New patients get intake forms ahead of time.' },
          { number: '02', title: 'Visit', description: 'The clinician reviews your history before you arrive, so visit time goes to the exam, not paperwork.' },
          { number: '03', title: 'Follow-Up', description: 'You leave with written instructions and a direct number for questions between visits.' },
        ],
      },
      {
        title: 'Your Visit',
        subtitle: 'What to expect',
        steps: [
          { number: '01', title: 'Book', description: 'Choose an appointment time online; same-week slots are held for acute needs.' },
          { number: '02', title: 'Evaluation', description: 'The exam covers what you booked for, and anything found gets explained before you leave.' },
          { number: '03', title: 'Care Plan', description: 'Leave with a written care plan, prescriptions routed, and a scheduled follow-up if one is needed.' },
        ],
      },
    ]
    return medicalBooking[hashSeed(`${seed}:process:booking_medical`) % medicalBooking.length]
  }

  const byModel: Record<string, ProcessConfig[]> = {
    booking: [
      {
        title: 'How It Works',
        subtitle: 'From booking to done',
        steps: [
          { number: '01', title: 'Book', description: `Pick a time that works for you and request your ${svc}.` },
          { number: '02', title: 'Confirm', description: 'We confirm the details and arrive on schedule.' },
          { number: '03', title: 'Done', description: 'We finish the job and make sure you\u2019re satisfied.' },
        ],
      },
      {
        title: 'Our Process',
        subtitle: 'Straightforward scheduling',
        steps: [
          { number: '01', title: 'Schedule', description: `Choose a convenient appointment for your ${svc}.` },
          { number: '02', title: 'Service', description: 'Our team arrives prepared and delivers the service with care.' },
          { number: '03', title: 'Follow Up', description: 'We check in to make sure everything meets your expectations.' },
        ],
      },
    ],
    order: [
      {
        title: 'How It Works',
        subtitle: 'From menu to ready',
        steps: [
          { number: '01', title: 'Browse', description: 'Explore the menu and choose what you want.' },
          { number: '02', title: 'Order', description: 'Place your order in a few taps.' },
          { number: '03', title: 'Enjoy', description: 'We prepare it and get it to you promptly.' },
        ],
      },
      {
        title: 'Our Process',
        subtitle: 'Simple ordering',
        steps: [
          { number: '01', title: 'Choose', description: 'Pick your favorites from our selection.' },
          { number: '02', title: 'Checkout', description: 'Order online quickly.' },
          { number: '03', title: 'Ready', description: 'Made to order and ready when you expect it.' },
        ],
      },
    ],
    ticket: [
      {
        title: 'How It Works',
        subtitle: 'Request to resolution',
        steps: [
          { number: '01', title: 'Reach Out', description: `Tell us what you need help with regarding ${svc}.` },
          { number: '02', title: 'Diagnose', description: 'We assess the situation and recommend the right fix.' },
          { number: '03', title: 'Resolve', description: 'We take care of it and confirm everything is working.' },
        ],
      },
      {
        title: 'Our Process',
        subtitle: 'Clear support steps',
        steps: [
          { number: '01', title: 'Request', description: `Submit your request for ${svc}.` },
          { number: '02', title: 'Respond', description: 'A specialist reviews and gets back to you quickly.' },
          { number: '03', title: 'Repair', description: 'We solve the problem and follow up to be sure.' },
        ],
      },
    ],
    quote: [
      {
        title: 'How It Works',
        subtitle: 'Clear from estimate to finish',
        steps: [
          { number: '01', title: 'Share details', description: `Tell us about your ${svc} needs.` },
          { number: '02', title: 'Get a plan', description: 'We walk through scope, timing, and pricing.' },
          { number: '03', title: 'We deliver', description: 'We complete the work and leave it ready for daily use.' },
        ],
      },
      {
        title: 'Our Process',
        subtitle: 'Practical next steps',
        steps: [
          { number: '01', title: 'Connect', description: `Start with a quick conversation about your ${svc}.` },
          { number: '02', title: 'Scope', description: 'We outline what\u2019s included and what it costs.' },
          { number: '03', title: 'Complete', description: 'We do the work carefully and confirm you\u2019re happy.' },
        ],
      },
    ],
  }

  const pool = byModel[engagementModel] || byModel.quote
  return pool[hashSeed(`${seed}:process:${engagementModel}`) % pool.length]
}
