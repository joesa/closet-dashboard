/**
 * Re-encode all site-assets images referenced by a tenant's custom draft +
 * published HTML, rewrite URLs, and print a size report.
 *
 * Usage:
 *   npx tsx scripts/optimize-tenant-images.ts <tenantId>
 */
import { reoptimizeTenantSiteImages } from '../src/lib/images/reoptimizeTenantSiteImages'

async function main() {
  const tenantId = process.argv[2]
  if (!tenantId) {
    console.error('Usage: npx tsx scripts/optimize-tenant-images.ts <tenantId>')
    process.exit(1)
  }
  const result = await reoptimizeTenantSiteImages(tenantId)
  console.log(
    JSON.stringify(
      {
        ...result,
        mbBefore: +(result.bytesBefore / 1e6).toFixed(2),
        mbAfter: +(result.bytesAfter / 1e6).toFixed(2),
        savedMb: +((result.bytesBefore - result.bytesAfter) / 1e6).toFixed(2),
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
