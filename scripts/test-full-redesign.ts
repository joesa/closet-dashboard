/**
 * One-off smoke test: run a full Claude redesign for a tenant and save it to
 * custom_config_draft (draft only — never touches the live site).
 *
 *   npx tsx --env-file=.env.local scripts/test-full-redesign.ts <tenantId>
 */
import { generateCustomSiteDraft } from '../src/lib/ai/generateCustomSite'

const tenantId = process.argv[2]
if (!tenantId) {
  console.error('Usage: npx tsx --env-file=.env.local scripts/test-full-redesign.ts <tenantId>')
  process.exit(1)
}

const started = Date.now()
generateCustomSiteDraft({ tenantId, intent: 'full', prompt: '' })
  .then((result) => {
    const secs = ((Date.now() - started) / 1000).toFixed(1)
    console.log(`\n=== DONE in ${secs}s ===`)
    console.log('reply:', result.reply)
    console.log('pages:', Object.keys(result.draft.pages))
    for (const [path, page] of Object.entries(result.draft.pages)) {
      console.log(`  ${path}: html=${page.html?.length ?? 0} chars, css=${page.css?.length ?? 0}`)
    }
    console.log('globalCss:', result.draft.globalCss?.length ?? 0, 'chars')
    console.log('warnings:', result.warnings)
    console.log('errors:', result.errors)
  })
  .catch((err) => {
    console.error('FAILED after', ((Date.now() - started) / 1000).toFixed(1), 's:', err)
    process.exit(1)
  })
