/**
 * Policy knobs for the Full redesign design guard, in one place.
 *
 * The guard has two halves that fail for different reasons and are tuned
 * separately: the *tell scanner* (does this artifact contain a banned AI
 * default?) and the *uniqueness check* (has this design already shipped to
 * another tenant?). Both start advisory and become blocking once calibrated
 * against real sites — flipping either is a one-line change here rather than a
 * hunt through the orchestrator.
 *
 * The `DesignTellCode` union lives here rather than in the scanner because this
 * file has to enumerate every code to assign severity; putting it here keeps the
 * runtime import graph acyclic (scanner -> policy, never the reverse).
 */

export type TellEnforcement = 'block' | 'warn'

export type DesignTellCode =
  // palette / colour
  | 'design_saas_gradient_hue'
  | 'design_gradient_instead_of_palette'
  | 'design_dark_neon_skin'
  | 'design_cream_terracotta_skin'
  // texture / surface
  | 'design_glassmorphism'
  | 'design_floating_orbs'
  | 'design_dot_grid_texture'
  // type
  | 'design_banned_font_family'
  | 'design_missing_font_link'
  // structure
  | 'design_triplet_icon_cards'
  | 'design_dual_lane_gateway'
  | 'design_hero_two_button_blob'
  | 'design_thin_home'
  | 'design_no_design_tokens'
  // chrome / copy-adjacent
  | 'design_emoji_in_ui'
  | 'design_em_dash_stack'
  | 'spec_sheet_cta'
  | 'decorative_numbered_list'
  /**
   * Uniqueness, not a tell: this home reproduces another tenant's section
   * rhythm. Raised by the finalize guard and the publish gate from the
   * fingerprint registry, never by scanning a single artifact.
   */
  | 'design_duplicate_skeleton'

/** Axes of a custom design fingerprint. Only some of them block. */
export type FingerprintAxis = 'palette' | 'fonts' | 'skeleton' | 'shape' | 'motifs'

/**
 * Publish-time behaviour for visual/structural tells.
 * Set to 'warn' while calibrating the scanner against real published sites;
 * 'block' once the false-positive rate on known-good artifacts is zero.
 */
export const DESIGN_TELL_ENFORCEMENT: TellEnforcement = 'block'

/**
 * Codes that stay advisory even under 'block'. These are the judgement calls:
 * three cards is sometimes genuinely the right answer, two hero CTAs is
 * sometimes genuinely the right answer, and a short page is sometimes an honest
 * page. Blocking on them would reject good work.
 */
export const ADVISORY_TELL_CODES: readonly DesignTellCode[] = [
  'design_triplet_icon_cards',
  'design_dual_lane_gateway',
  'design_hero_two_button_blob',
  'design_thin_home',
]

export function tellSeverity(code: DesignTellCode): 'error' | 'warning' {
  if (ADVISORY_TELL_CODES.includes(code)) return 'warning'
  // Uniqueness has its own switch — it is a different product decision from
  // "does this artifact contain a banned default".
  if (code === 'design_duplicate_skeleton') {
    return UNIQUENESS_ENFORCEMENT === 'block' ? 'error' : 'warning'
  }
  return DESIGN_TELL_ENFORCEMENT === 'block' ? 'error' : 'warning'
}

/** Which tenants a candidate design is compared against. */
export const UNIQUENESS_SCOPE: 'platform' | 'industry' = 'platform'

export const UNIQUENESS_ENFORCEMENT: TellEnforcement = 'block'

/**
 * The axes a collision is judged on. Skeleton only, deliberately.
 *
 * Home section rhythm is an ordered sequence over a ~12-symbol vocabulary, so
 * platform-wide uniqueness on it does not exhaust the space the way palette-wide
 * blocking would after a few hundred tenants. The consequence, accepted
 * knowingly: two tenants may share a palette and a type pairing as long as their
 * section rhythm differs. The other axes are still extracted, still recorded,
 * still fed to the model as "already used", and still reported as warnings.
 */
export const BLOCKING_AXES: readonly FingerprintAxis[] = ['skeleton']

/**
 * Normalized-LCS score above which two skeletons count as the same design.
 * 0.85 lets a genuinely different rhythm through while catching the case that
 * matters: the same sequence with one section swapped or renamed.
 */
export const SKELETON_COLLISION_THRESHOLD = 0.85

/** Repair attempts per failing unit (globalCss counts as one unit). */
export const MAX_REPAIR_ATTEMPTS_PER_UNIT = 2

/**
 * Wall-clock point in a run after which guards scan and warn but stop spending
 * model calls. Measured from the start of runFullGenerate, not from the job row:
 * a resumed job gets a fresh budget, which is correct — it also has fresh work.
 */
export const REPAIR_CUTOFF_MS = 30 * 60 * 1000

export const AVOID_LIST_MAX_ROWS = 60
export const AVOID_LIST_MAX_CHARS = 1400
