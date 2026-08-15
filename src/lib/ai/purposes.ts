/**
 * Every distinct AI job in the application, as a stable id an admin can point
 * at a provider and model.
 *
 * The ids are the contract between three things: the call site that asks for
 * generation, the `ai_purpose_assignments` row that overrides it, and the admin
 * screen that lists them. Renaming one orphans its assignment row, so treat
 * these like column names.
 *
 * `fallback` names the chain a purpose uses when nothing is configured, which
 * is exactly what that call site does today. This is what makes an empty
 * configuration behave identically to the code before this feature existed.
 */

export type AiPurposeCategory = 'text' | 'image'

/**
 * Which built-in chain backs a purpose when unconfigured.
 * - `full_redesign` — FULL_REDESIGN_PROVIDER_CHAIN (Anthropic → OpenAI → Gemini)
 * - `surgical`      — SURGICAL_PROVIDER_CHAIN (Gemini → OpenAI → Anthropic)
 * - `default`       — DEFAULT_PROVIDER_CHAIN (OpenAI → Gemini → Anthropic)
 * - `image`         — gpt-image-1 with the Gemini image fallback
 */
export type AiPurposeFallback = 'full_redesign' | 'surgical' | 'default' | 'image'

export type AiPurposeDef = {
  label: string
  category: AiPurposeCategory
  description: string
  fallback: AiPurposeFallback
}

export const AI_PURPOSES = {
  // --- Full redesign -------------------------------------------------------
  full_redesign_brief: {
    label: 'Full redesign — brief',
    category: 'text',
    description: 'Turns admin notes and scraped facts into the locked design brief.',
    fallback: 'full_redesign',
  },
  full_redesign_preflight: {
    label: 'Full redesign — preflight review',
    category: 'text',
    description: 'Independent review of the brief before any page is generated.',
    fallback: 'full_redesign',
  },
  full_redesign_foundation: {
    label: 'Full redesign — foundation',
    category: 'text',
    description: 'Global CSS and the home page; sets the visual language every later pass follows.',
    fallback: 'full_redesign',
  },
  full_redesign_page: {
    label: 'Full redesign — page',
    category: 'text',
    description: 'One pass per interior page. The highest-volume call in a redesign.',
    fallback: 'full_redesign',
  },
  full_redesign_repair: {
    label: 'Full redesign — guard repair',
    category: 'text',
    description: 'Fixes a page that failed the design guard, in place.',
    fallback: 'full_redesign',
  },

  // --- Editing and validation ---------------------------------------------
  surgical_edit: {
    label: 'Surgical edit',
    category: 'text',
    description: 'Targeted site-wide edits (renames, copy tweaks) that must not redesign anything.',
    fallback: 'surgical',
  },
  autofix_site_issues: {
    label: 'Auto-fix validation issues',
    category: 'text',
    description: 'Repairs issues the site validator flags after a build.',
    fallback: 'default',
  },

  // --- Site + intake text --------------------------------------------------
  site_config_generate: {
    label: 'Site config generation',
    category: 'text',
    description: 'First-pass site config for a newly provisioned tenant.',
    fallback: 'default',
  },
  intake_page_copy: {
    label: 'Intake page copy',
    category: 'text',
    description: 'Per-page copy generated from the intake answers.',
    fallback: 'default',
  },
  intake_suggest_pages: {
    label: 'Intake page suggestions',
    category: 'text',
    description: 'Suggests which pages a business should have.',
    fallback: 'default',
  },
  sitemap: {
    label: 'Sitemap generation',
    category: 'text',
    description: 'Proposes the site structure.',
    fallback: 'default',
  },
  copy_generate: {
    label: 'Copy generation',
    category: 'text',
    description: 'Ad-hoc copy from the admin copy tool.',
    fallback: 'default',
  },
  quiz_config: {
    label: 'Quiz configuration',
    category: 'text',
    description: 'Builds the lead-capture quiz for a tenant.',
    fallback: 'default',
  },
  widget_config: {
    label: 'Widget configuration',
    category: 'text',
    description: 'Builds the embedded estimator widget config.',
    fallback: 'default',
  },
  theme_tokens: {
    label: 'Theme token synthesis',
    category: 'text',
    description: 'Derives color and type tokens for a tenant theme.',
    fallback: 'default',
  },
  business_brief_parse: {
    label: 'Business brief parsing',
    category: 'text',
    description: 'Extracts structured facts from a free-text business description.',
    fallback: 'default',
  },
  craft_answers: {
    label: 'Craft answer suggestions',
    category: 'text',
    description: 'Suggests intake answers in the owner’s voice. Small and cheap — a good first target for a local model.',
    fallback: 'default',
  },
  ideal_customers: {
    label: 'Ideal customer suggestions',
    category: 'text',
    description: 'Proposes target customer segments during intake.',
    fallback: 'default',
  },
  custom_industry: {
    label: 'Custom industry generation',
    category: 'text',
    description: 'Builds a catalog entry for an industry not already covered.',
    fallback: 'default',
  },
  site_presentation: {
    label: 'Site presentation resolution',
    category: 'text',
    description: 'Chooses how services and galleries are presented for a tenant.',
    fallback: 'default',
  },
  spec_research_facts: {
    label: 'Spec build research',
    category: 'text',
    description: 'Extracts verifiable public facts about a cold lead.',
    fallback: 'default',
  },
  admin_chat: {
    label: 'Admin site chat',
    category: 'text',
    description: 'The admin’s conversational site editor.',
    fallback: 'default',
  },

  // --- Images --------------------------------------------------------------
  // Ollama and LM Studio are text/vision only and cannot serve these. A local
  // provider works here only if it exposes OpenAI-compatible
  // /v1/images/generations (LocalAI and some ComfyUI/vLLM gateways do).
  image_service: {
    label: 'Service and hero images',
    category: 'image',
    description: 'Generates the hero and per-service imagery for a site.',
    fallback: 'image',
  },
  image_edit: {
    label: 'Image edit from reference',
    category: 'image',
    description: 'Edits an existing image rather than generating from scratch.',
    fallback: 'image',
  },
  image_before_after: {
    label: 'Before/after images',
    category: 'image',
    description: 'Generates the "before" half of a before/after pair.',
    fallback: 'image',
  },
  image_logo: {
    label: 'Logo generation',
    category: 'image',
    description: 'Generates a wordmark or logo during intake.',
    fallback: 'image',
  },
  image_spec: {
    label: 'Spec build images',
    category: 'image',
    description: 'Imagery for unattended spec builds.',
    fallback: 'image',
  },
} as const satisfies Record<string, AiPurposeDef>

export type AiPurpose = keyof typeof AI_PURPOSES

export const AI_PURPOSE_IDS = Object.keys(AI_PURPOSES) as AiPurpose[]

export function isAiPurpose(value: string): value is AiPurpose {
  return Object.prototype.hasOwnProperty.call(AI_PURPOSES, value)
}

export function getAiPurpose(purpose: AiPurpose): AiPurposeDef {
  return AI_PURPOSES[purpose]
}

/** Purposes grouped for the admin screen, text first. */
export function aiPurposesByCategory(): Record<AiPurposeCategory, AiPurpose[]> {
  const grouped: Record<AiPurposeCategory, AiPurpose[]> = { text: [], image: [] }
  for (const id of AI_PURPOSE_IDS) {
    grouped[AI_PURPOSES[id].category].push(id)
  }
  return grouped
}
