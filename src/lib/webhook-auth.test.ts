import { describe, it, expect } from 'vitest'
import { extractBearerOrHeaderToken, assertWebhookToken } from './webhook-auth'

describe('extractBearerOrHeaderToken', () => {
  it('reads bearer authorization', () => {
    const req = new Request('https://example.com', {
      headers: { authorization: 'Bearer secret-token' },
    })
    expect(extractBearerOrHeaderToken(req)).toBe('secret-token')
  })

  it('reads x-webhook-token header', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-webhook-token': 'header-token' },
    })
    expect(extractBearerOrHeaderToken(req)).toBe('header-token')
  })

  it('reads scraper control plane headers when configured', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-scraper-token': 'scraper-token' },
    })
    expect(extractBearerOrHeaderToken(req, ['x-scraper-token', 'x-api-key'])).toBe(
      'scraper-token'
    )
  })
})

describe('assertWebhookToken', () => {
  it('returns 500 when expected token is missing', async () => {
    const req = new Request('https://example.com')
    const res = assertWebhookToken(req, undefined)
    expect(res?.status).toBe(500)
  })

  it('returns 401 when token does not match', async () => {
    const req = new Request('https://example.com', {
      headers: { authorization: 'Bearer wrong' },
    })
    const res = assertWebhookToken(req, 'expected')
    expect(res?.status).toBe(401)
  })

  it('returns null when token matches', () => {
    const req = new Request('https://example.com', {
      headers: { authorization: 'Bearer expected' },
    })
    expect(assertWebhookToken(req, 'expected')).toBeNull()
  })
})
