import { describe, expect, it } from 'vitest'
import { adminWantsAttachmentsOnSite } from './persistAssistantAttachments'

describe('adminWantsAttachmentsOnSite', () => {
  it('detects placement intent', () => {
    expect(adminWantsAttachmentsOnSite('Use this image as the hero background')).toBe(true)
    expect(adminWantsAttachmentsOnSite('Set the attached photo on Auto Wrapping')).toBe(true)
    expect(adminWantsAttachmentsOnSite('Replace the before image with this')).toBe(true)
    expect(adminWantsAttachmentsOnSite('Feature this photo in the services section')).toBe(true)
    expect(adminWantsAttachmentsOnSite('Make this the homepage banner')).toBe(true)
    expect(adminWantsAttachmentsOnSite('Show the uploaded files in our portfolio')).toBe(true)
  })

  it('treats diagnostic screenshots as reference-only', () => {
    expect(adminWantsAttachmentsOnSite('See the screenshot — the hero text is cut off')).toBe(
      false
    )
    expect(adminWantsAttachmentsOnSite('Just a screenshot of the problem on mobile')).toBe(false)
    expect(adminWantsAttachmentsOnSite("Don't use this — for reference only")).toBe(false)
    expect(adminWantsAttachmentsOnSite('This screenshot shows what is wrong with the gallery')).toBe(false)
    expect(adminWantsAttachmentsOnSite('Here are examples so you can understand the style')).toBe(false)
    expect(adminWantsAttachmentsOnSite('Please fix the spacing shown in these images')).toBe(false)
  })
})
