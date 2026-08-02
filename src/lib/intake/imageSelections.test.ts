import { describe, expect, it } from 'vitest'
import { emptyImageSelections, getImageSelectionIssues } from './imageSelections'

describe('getImageSelectionIssues', () => {
  it('names the missing hero, service image, and before/after choice', () => {
    const issues = getImageSelectionIssues(
      emptyImageSelections(),
      ['Custom Closets'],
      true
    )
    expect(issues).toEqual([
      expect.objectContaining({ id: 'hero', message: 'Choose a hero image.' }),
      expect.objectContaining({
        id: 'product-0',
        message: 'Choose an image for Custom Closets.',
      }),
      expect.objectContaining({
        id: 'before-after-choice',
        message: 'Choose whether to include before/after photos.',
      }),
    ])
  })

  it('identifies each missing upload for upload-both mode', () => {
    const selections = emptyImageSelections()
    selections.hero.selectedUrl = 'https://example.com/hero.jpg'
    selections.beforeAfter = {
      attemptsUsed: 0,
      history: [],
      enabled: true,
      mode: 'upload_both',
    }
    expect(getImageSelectionIssues(selections, [], true).map((issue) => issue.id)).toEqual([
      'before-photo',
      'after-photo',
    ])
  })

  it('does not require before/after assets when the user skips them', () => {
    const selections = emptyImageSelections()
    selections.hero.selectedUrl = 'https://example.com/hero.jpg'
    selections.beforeAfter = {
      attemptsUsed: 0,
      history: [],
      enabled: false,
    }
    expect(getImageSelectionIssues(selections, [], true)).toEqual([])
  })
})