import { describe, expect, it } from 'vitest'
import { adminWantsAttachmentsOnSite } from './persistAssistantAttachments'

describe('adminWantsAttachmentsOnSite', () => {
  it('detects placement intent', () => {
    expect(adminWantsAttachmentsOnSite('Use this image as the hero background')).toBe(true)
    expect(adminWantsAttachmentsOnSite('Set the attached photo on Auto Wrapping')).toBe(true)
    expect(adminWantsAttachmentsOnSite('Replace the before image with this')).toBe(true)
  })

  it('treats diagnostic screenshots as reference-only', () => {
    expect(adminWantsAttachmentsOnSite('See the screenshot — the hero text is cut off')).toBe(
      false
    )
    expect(adminWantsAttachmentsOnSite('Just a screenshot of the problem on mobile')).toBe(false)
    expect(adminWantsAttachmentsOnSite("Don't use this — for reference only")).toBe(false)
  })
})
