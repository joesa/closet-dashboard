import { createHash } from 'node:crypto'

export type UnitTextMap = Record<string, string>

export type UnitQualityFinding = {
  unitId: string
  code: string
  message: string
  samples: string[]
}

export type UnitQualityReport = {
  status: 'passed' | 'failed'
  findings: UnitQualityFinding[]
  failedUnitIds: string[]
}

export type QualityRetryResult<T extends UnitTextMap> = {
  output: T
  report: UnitQualityReport
  attempts: number
  status: 'passed' | 'failed'
  retryError?: string
}

function outputHash(value: UnitTextMap): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export async function generateWithQualityRetry<T extends UnitTextMap>(input: {
  initial: T
  validate: (output: T) => UnitQualityReport
  regenerate: (request: {
    attempt: number
    failedUnitIds: string[]
    findings: UnitQualityFinding[]
    current: T
  }) => Promise<Partial<T>>
  maxRetries?: number
}): Promise<QualityRetryResult<T>> {
  const maxRetries = input.maxRetries ?? 2
  let output = { ...input.initial }
  let report = input.validate(output)
  let attempts = 1
  let retryError: string | undefined
  const seenHashes = new Set([outputHash(output)])

  for (let retry = 1; report.status === 'failed' && retry <= maxRetries; retry += 1) {
    const failed = new Set(report.failedUnitIds)
    let replacement: Partial<T>
    attempts += 1
    try {
      replacement = await input.regenerate({
        attempt: retry,
        failedUnitIds: report.failedUnitIds,
        findings: report.findings.filter((finding) => failed.has(finding.unitId)),
        current: output,
      })
    } catch (error) {
      retryError = error instanceof Error ? error.message : String(error)
      break
    }
    const allowedEntries = Object.entries(replacement).filter(
      ([unitId, value]) => failed.has(unitId) && typeof value === 'string' && value.trim()
    )
    output = { ...output, ...Object.fromEntries(allowedEntries) } as T

    const hash = outputHash(output)
    report = input.validate(output)
    if (seenHashes.has(hash)) break
    seenHashes.add(hash)
  }

  return { output, report, attempts, status: report.status, retryError }
}