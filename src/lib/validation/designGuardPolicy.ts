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
  | 'design_missing_responsive_contract'
  | 'design_missing_interaction_contract'
  | 'design_direction_incoherent'
  | 'design_hairline_box_grid'
  | 'design_gap_outlined_grid'
  | 'design_uncentered_shell'
  /**
   * The markup and the stylesheet disagree about class names, so most of the
   * page has no rules at all and renders as unstyled HTML. Not a taste call:
   * a page in this state is broken, whatever the brief asked for.
   */
  | 'design_unstyled_markup'
  // chrome / copy-adjacent
  | 'design_emoji_in_ui'
  | 'design_em_dash_stack'
  | 'spec_sheet_cta'
  | 'decorative_numbered_list'
  /**
    * Uniqueness, not a tell: this artifact reproduces a prior design's visual
    * system. Raised by the finalize guard and publish gate from the fingerprint
    * registry, never by scanning a single artifact.
   */
  | 'design_duplicate_visual'

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
  // Positive art-direction scoring is intentionally advisory while its signal
  // thresholds are calibrated against the fleet. It must reward coherence,
  // not force every site toward one preferred visual style.
  'design_direction_incoherent',
]

export function tellSeverity(code: DesignTellCode): 'error' | 'warning' {
  if (ADVISORY_TELL_CODES.includes(code)) return 'warning'
  // Uniqueness has its own switch — it is a different product decision from
  // "does this artifact contain a banned default".
  if (code === 'design_duplicate_visual') {
    return UNIQUENESS_ENFORCEMENT === 'block' ? 'error' : 'warning'
  }
  return DESIGN_TELL_ENFORCEMENT === 'block' ? 'error' : 'warning'
}

/** Which tenants a candidate design is compared against. */
export const UNIQUENESS_SCOPE: 'platform' | 'industry' = 'platform'

export const UNIQUENESS_ENFORCEMENT: TellEnforcement = 'block'

/**
 * Every extracted visual axis contributes to collision detection. A redesign
 * cannot escape by reordering sections while retaining the same visual skin.
 */
export const BLOCKING_AXES: readonly FingerprintAxis[] = [
  'palette',
  'fonts',
  'skeleton',
  'shape',
  'motifs',
]

/**
 * Normalized-LCS score above which two skeletons count as the same design.
 * 0.85 lets a genuinely different rhythm through while catching the case that
 * matters: the same sequence with one section swapped or renamed.
 */
export const SKELETON_COLLISION_THRESHOLD = 0.85

/** Weighted palette/type/composition/geometry/motif similarity that blocks. */
export const VISUAL_COLLISION_THRESHOLD = 0.6

/**
 * Fleet-frequency guard. Pairwise similarity misses slow convergence: 19 of 20
 * sites can share hairline grids, uppercase chrome and photo bleed while every
 * pair stays under the collision threshold. Any single axis value used by this
 * share of the fleet (given a minimum sample) is "saturated"; a candidate that
 * reuses FLEET_CONVERGENCE_BLOCK_COUNT saturated values or more is rejected.
 */
export const FLEET_CONVERGENCE_SHARE_LIMIT = 0.8
export const FLEET_CONVERGENCE_MIN_SAMPLE = 10
export const FLEET_CONVERGENCE_BLOCK_COUNT = 3

/**
 * Design-family guard. Families are coarse (tone × geometry × chrome register)
 * on purpose — they catch "every redesign is some editorial variant" even when
 * fonts, accents and sections all differ.
 */
export const FAMILY_RECENT_WINDOW = 20
export const FAMILY_MIN_SAMPLE = 10
export const FAMILY_SHARE_LIMIT = 0.5


/** Repair attempts per failing unit (globalCss counts as one unit). */
export const MAX_REPAIR_ATTEMPTS_PER_UNIT = 2

/**
 * Wall-clock point in a run after which guards scan and warn but stop spending
 * model calls. Measured from the start of runFullGenerate, not from the job row:
 * a resumed job gets a fresh budget, which is correct — it also has fresh work.
 */
export const REPAIR_CUTOFF_MS = 30 * 60 * 1000

export const AVOID_LIST_MAX_ROWS = 2000
export const AVOID_LIST_MAX_CHARS = 1400

/** Capacity telemetry thresholds; these warn operators but never reject a job. */
export const TYPOGRAPHY_RECENT_WINDOW = 50
export const TYPOGRAPHY_PROBE_ALERT_THRESHOLD = 20
export const TYPOGRAPHY_PREFERRED_POOL_ALERT_RATIO = 0.7
export const DIRECTION_RESERVATION_TTL_MINUTES = 60
