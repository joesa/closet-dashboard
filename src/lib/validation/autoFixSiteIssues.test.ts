import { describe, expect, it } from 'vitest'
import { htmlTextSegments, rewriteDuplicateIdsInHtml } from './autoFixSiteIssues'

describe('htmlTextSegments', () => {
  it('replaces visible text without changing markup or hidden source', () => {
    const page = {
      html: '<main><h1>Elevate your shop</h1><script>const copy = "Elevate"</script><p>Plain copy</p></main>',
    }
    const segments = htmlTextSegments(page)
    expect(segments.map((segment) => segment.text)).toEqual([
      'Elevate your shop',
      'Plain copy',
    ])

    segments[0].replace('Organize your shop')
    expect(page.html).toBe(
      '<main><h1>Organize your shop</h1><script>const copy = "Elevate"</script><p>Plain copy</p></main>'
    )
  })
})

describe('rewriteDuplicateIdsInHtml', () => {
  it('renames duplicate ids to unique values', () => {
    const input = '<main><h1>Acme</h1><section id="about"><p>One</p></section><section id="about"><p>Two</p></section><footer>Done</footer></main>'
    const { html, duplicateIds } = rewriteDuplicateIdsInHtml(input)

    expect(duplicateIds).toEqual(['about'])
    expect(html).toContain('id="about"')
    expect(html).toContain('id="about--2"')
  })
})