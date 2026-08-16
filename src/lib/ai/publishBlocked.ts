import type { ArtifactValidationIssue } from '@/lib/validation/siteArtifactValidator'

/**
 * A publish refused by the design/validation gate.
 *
 * Distinct from a thrown Error so the API can answer 409 instead of 500: the
 * request was understood and the server is fine — the draft simply is not
 * publishable yet. Reporting it as a server fault buries a routine, actionable
 * outcome in error monitoring and tells the admin nothing about what to fix.
 */
export class PublishBlockedError extends Error {
  readonly issues: ArtifactValidationIssue[]

  constructor(message: string, issues: ArtifactValidationIssue[]) {
    super(message)
    this.name = 'PublishBlockedError'
    this.issues = issues
  }
}

export function isPublishBlockedError(err: unknown): err is PublishBlockedError {
  return err instanceof PublishBlockedError
}
