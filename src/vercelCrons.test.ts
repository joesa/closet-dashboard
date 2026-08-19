import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Vercel's Hobby plan accepts daily cron schedules only. A more frequent one is
 * not a warning — the deployment is refused outright, and because the refusal
 * happens in the git integration it shows up as "nothing deployed" with a green
 * CI run. Three commits sat unshipped that way before anyone noticed.
 *
 * Anything needing sub-daily frequency belongs in worker/src/scheduler.ts,
 * which runs on the always-on VM and is not subject to the plan limit.
 */
const crons = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'vercel.json'), 'utf8')
).crons as Array<{ path: string; schedule: string }>

/** True when the expression fires at most once per day. */
function runsAtMostDaily(schedule: string): boolean {
  const [minute, hour] = schedule.trim().split(/\s+/)
  const isFixed = (field: string) => /^\d+$/.test(field)
  return isFixed(minute) && isFixed(hour)
}

describe('vercel.json crons', () => {
  it('declares at least one cron (guards against an empty-file false pass)', () => {
    expect(crons.length).toBeGreaterThan(0)
  })

  it.each(crons.map((c) => [c.path, c.schedule]))(
    '%s runs at most once per day (%s)',
    (_path, schedule) => {
      expect(runsAtMostDaily(schedule)).toBe(true)
    }
  )

  it('rejects the sub-daily forms that caused the outage', () => {
    expect(runsAtMostDaily('*/15 * * * *')).toBe(false)
    expect(runsAtMostDaily('0 */6 * * *')).toBe(false)
    expect(runsAtMostDaily('0 5 * * *')).toBe(true)
    expect(runsAtMostDaily('0 16 * * 1-5')).toBe(true)
  })
})
