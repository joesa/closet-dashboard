# Site image optimization

User and admin photos are resized + mozjpeg-encoded with sharp before they land
in the public `site-assets` bucket.

## Profiles (`optimizeUserImage`)

| Kind | Max size | Quality |
|------|----------|---------|
| hero | 3840px long edge (Lanczos3 upscale + restrained sharpening when smaller) | 92 |
| gallery / general | 1600×1600 | 82 |
| product | 1400×1400 | 82 |
| logo | 800×800 (PNG if alpha) | 90 |

## Paths that must optimize

- Intake `/upload-image` and gallery/logo PATCH (already)
- **Admin Media** multipart + signed-upload `complete` (post-process)
- AI `uploadSiteAsset` / generate-and-upload

## Reoptimize an existing tenant

Rewrites draft + published custom HTML URLs to new `custom/<tenantId>/opt/…` objects:

```bash
npx tsx scripts/optimize-tenant-images.ts <tenantId>
```
