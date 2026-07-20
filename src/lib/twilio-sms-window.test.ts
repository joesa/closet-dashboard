import { describe, it, expect } from 'vitest'
import { isWithinSmsSendWindow } from './twilio-sms'

describe('isWithinSmsSendWindow', () => {
  it('returns true when enforcement is disabled', () => {
    const prev = process.env.SMS_SEND_WINDOW_ENFORCE
    process.env.SMS_SEND_WINDOW_ENFORCE = 'false'
    try {
      // Sunday noon UTC — would normally be outside weekday window
      expect(isWithinSmsSendWindow(new Date('2026-07-19T17:00:00Z'))).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.SMS_SEND_WINDOW_ENFORCE
      else process.env.SMS_SEND_WINDOW_ENFORCE = prev
    }
  })

  it('allows a weekday mid-day Chicago hour', () => {
    const prev = process.env.SMS_SEND_WINDOW_ENFORCE
    delete process.env.SMS_SEND_WINDOW_ENFORCE
    try {
      // 2026-07-20 is a Monday; 15:00 UTC = 10:00 America/Chicago (CDT)
      expect(isWithinSmsSendWindow(new Date('2026-07-20T15:00:00Z'))).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.SMS_SEND_WINDOW_ENFORCE
      else process.env.SMS_SEND_WINDOW_ENFORCE = prev
    }
  })

  it('blocks weekend Chicago time', () => {
    const prev = process.env.SMS_SEND_WINDOW_ENFORCE
    delete process.env.SMS_SEND_WINDOW_ENFORCE
    try {
      // 2026-07-19 Sunday 15:00 UTC = 10:00 CDT
      expect(isWithinSmsSendWindow(new Date('2026-07-19T15:00:00Z'))).toBe(false)
    } finally {
      if (prev === undefined) delete process.env.SMS_SEND_WINDOW_ENFORCE
      else process.env.SMS_SEND_WINDOW_ENFORCE = prev
    }
  })
})
