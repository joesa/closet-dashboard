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
  if (service) return `${brand} — ${service}`
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

export function defaultProductSpecs(
  engagementModel: string,
  serviceName: string,
  differentiators?: string[] | null
): string[] {
  const fromIntake = (differentiators || [])
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, 4)
  if (fromIntake.length > 0) return fromIntake

  const eng = (engagementModel || 'quote').toLowerCase()
  if (eng === 'order') {
    return ['Made to order', 'Fresh preparation', 'Clear pricing']
  }
  if (eng === 'booking') {
    return ['Easy scheduling', 'On-time arrival', 'Clear next steps']
  }
  if (eng === 'ticket') {
    return ['Fast response', 'Clear diagnosis', 'Confirmed resolution']
  }
  const svc = serviceName.trim() || 'this service'
  return [`Focused on ${svc}`, 'Upfront communication', 'Done right the first time']
}

export function buildDefaultAbout(
  businessName: string,
  primaryService: string,
  serviceArea: string | undefined,
  seed: string
): { description: string } {
  const svc = (primaryService || 'quality work').toLowerCase()
  const area = serviceArea?.trim() || 'the areas we serve'
  const variants = [
    `${businessName} delivers dependable ${svc} across ${area}. We treat every job with care and respect for your property, and we stand behind the result.`,
    `Across ${area}, ${businessName} is known for straightforward ${svc}. You get clear expectations, fair pricing, and work that holds up.`,
    `${businessName} focuses on reliable ${svc} with honest communication from the first call through the final walkthrough.`,
  ]
  return { description: variants[hashSeed(`${seed}:about`) % variants.length] }
}

type ProcessConfig = {
  title: string
  subtitle: string
  steps: Array<{ number: string; title: string; description: string }>
}

export function buildDefaultProcess(
  engagementModel: string,
  primaryService: string,
  seed: string
): ProcessConfig {
  const svc = (primaryService || 'the work').toLowerCase()
  const byModel: Record<string, ProcessConfig[]> = {
    booking: [
      {
        title: 'How It Works',
        subtitle: 'From booking to done',
        steps: [
          { number: '01', title: 'Book', description: `Pick a time that works for you and request your ${svc}.` },
          { number: '02', title: 'Confirm', description: 'We confirm the details and arrive on schedule.' },
          { number: '03', title: 'Done', description: 'We finish the job and make sure you’re satisfied.' },
        ],
      },
      {
        title: 'Our Process',
        subtitle: 'Straightforward scheduling',
        steps: [
          { number: '01', title: 'Schedule', description: `Choose a convenient appointment for your ${svc}.` },
          { number: '02', title: 'Service', description: 'Our team shows up prepared and gets to work.' },
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
          { number: '02', title: 'Scope', description: 'We outline what’s included and what it costs.' },
          { number: '03', title: 'Complete', description: 'We do the work carefully and confirm you’re happy.' },
        ],
      },
    ],
  }

  const pool = byModel[engagementModel] || byModel.quote
  return pool[hashSeed(`${seed}:process:${engagementModel}`) % pool.length]
}
