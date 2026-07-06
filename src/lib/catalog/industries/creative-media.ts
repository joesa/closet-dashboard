import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32'

function ph(label: string, group: string, industry: 'photography-video' | 'drone-services' | 'home-staging', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['media-creative', 'luxury-gallery', 'modern-office', 'elegant-dressing'] as const
const L = ['gallery-showcase', 'portfolio-first', 'visual-impact', 'storyteller'] as const

export const PHOTOGRAPHY_VIDEO_SERVICES: ServiceDef[] = [
  ph('Real Estate Photography', 'Real Estate', 'photography-video', [...T, 'window-light'], [...L, 'conversion-focus'], { image: IMG, description: 'HDR real estate photos delivered within 24 hours — MLS-ready and stunning.' }, ['real estate photography', 'real estate photos', 'home photography', 'listing photos', 'property photos']),
  ph('Event Photography', 'Events', 'photography-video', ['media-creative', 'event-festive', 'luxury-gallery', 'classic-warm'], ['gallery-showcase', 'portfolio-first', 'event-booking', 'storyteller'], { image: IMG, description: 'Weddings, corporate events, parties, and milestone events captured in full.' }, ['event photography', 'wedding photographer', 'party photographer', 'corporate photography']),
  ph('Commercial & Product Photography', 'Commercial', 'photography-video', ['media-creative', 'luxury-gallery', 'modern-office', 'minimalist-zen'], ['gallery-showcase', 'portfolio-first', 'visual-impact', 'trust-builder'], { image: IMG, description: 'E-commerce, marketing, and brand photography for products and services.' }, ['product photography', 'commercial photography', 'brand photography', 'marketing photos']),
  ph('Video Production & Reels', 'Video', 'photography-video', ['media-creative', 'sleek-entertainment', 'modern-office', 'brutalist'], ['gallery-showcase', 'visual-impact', 'portfolio-first', 'storyteller'], { image: IMG, description: 'Promotional videos, social media reels, and testimonial video production.' }, ['video production', 'promo video', 'social media video', 'reels', 'brand video']),
  ph('Real Estate Video Tour', 'Real Estate', 'photography-video', ['media-creative', 'window-light', 'luxury-gallery', 'modern-office'], ['gallery-showcase', 'visual-impact', 'portfolio-first', 'conversion-focus'], { image: IMG, description: 'Cinematic walkthrough videos and virtual tours for faster property sales.' }, ['real estate video', 'virtual tour', 'walkthrough video', 'home tour video']),
]

export const DRONE_SERVICES_SERVICES: ServiceDef[] = [
  ph('Aerial Photography & Video', 'Aerial', 'drone-services', [...T], [...L], { image: IMG, description: 'FAA Part 107 drone pilots capturing stunning aerial photos and footage.' }, ['drone photography', 'aerial photography', 'drone video', 'aerial footage', 'drone photos']),
  ph('Real Estate Aerial Shots', 'Real Estate', 'drone-services', ['media-creative', 'window-light', 'luxury-gallery', 'modern-office'], ['gallery-showcase', 'portfolio-first', 'visual-impact', 'conversion-focus'], { image: IMG, description: 'Drone exterior and neighborhood shots for real estate listings.' }, ['real estate drone', 'aerial real estate', 'drone listing photos', 'drone property']),
  ph('Roof & Property Inspection Drone', 'Inspection', 'drone-services', ['home-guardian', 'commercial-pro', 'modern-office', 'functional-utility'], ['trust-report', 'gallery-showcase', 'trust-builder', 'compact-quote'], { image: IMG, description: 'Safe roof, siding, and commercial property inspection without a ladder.' }, ['drone roof inspection', 'drone inspection', 'aerial inspection', 'property inspection drone']),
  ph('Construction Progress Drone', 'Commercial', 'drone-services', ['commercial-pro', 'media-creative', 'brutalist', 'modern-office'], ['gallery-showcase', 'trust-builder', 'portfolio-first', 'visual-impact'], { image: IMG, description: 'Regular drone site photography to document project progress for clients.' }, ['construction drone', 'site photography', 'progress photos', 'aerial site']),
]

export const HOME_STAGING_SERVICES: ServiceDef[] = [
  ph('Full Home Staging', 'Staging', 'home-staging', ['media-creative', 'luxury-minimal', 'elegant-dressing', 'classic-warm'], ['gallery-showcase', 'before-after', 'portfolio-first', 'storyteller'], { image: IMG, description: 'Professionally staged listings sell faster and for more — full furniture staging.' }, ['home staging', 'house staging', 'real estate staging', 'vacant home staging']),
  ph('Occupied Home Staging', 'Staging', 'home-staging', ['media-creative', 'luxury-minimal', 'classic-warm', 'warm-handyman'], ['before-after', 'trust-builder', 'portfolio-first', 'conversion-focus'], { image: IMG, description: 'We work with your existing furniture to prepare your home for listing photos.' }, ['occupied staging', 'staging consultation', 'staging advice', 'declutter staging']),
  ph('Virtual Staging', 'Digital', 'home-staging', ['media-creative', 'modern-office', 'luxury-minimal', 'minimalist-zen'], ['gallery-showcase', 'before-after', 'portfolio-first', 'compact-quote'], { image: IMG, description: 'Digitally furnished photos for vacant listings — fast, affordable, stunning.' }, ['virtual staging', 'digital staging', 'virtual home staging', 'photo staging']),
]

export const PHOTOGRAPHY_VIDEO_INDUSTRY: IndustryDef = {
  slug: 'photography-video', label: 'Photography & Videography',
  keywords: ['photography', 'real estate photography', 'event photography', 'video production', 'photographer'],
  serviceGroups: ['Real Estate', 'Events', 'Commercial', 'Video'],
  defaultThemes: ['media-creative', 'luxury-gallery', 'modern-office', 'elegant-dressing'],
  defaultLayouts: ['gallery-showcase', 'portfolio-first', 'visual-impact', 'storyteller'],
  services: PHOTOGRAPHY_VIDEO_SERVICES,
}

export const DRONE_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'drone-services', label: 'Drone Services',
  keywords: ['drone', 'drone photography', 'aerial photography', 'drone video', 'faa drone', 'aerial footage'],
  serviceGroups: ['Aerial', 'Real Estate', 'Inspection', 'Commercial'],
  defaultThemes: ['media-creative', 'luxury-gallery', 'modern-office', 'commercial-pro'],
  defaultLayouts: ['gallery-showcase', 'portfolio-first', 'visual-impact', 'trust-report'],
  services: DRONE_SERVICES_SERVICES,
}

export const HOME_STAGING_INDUSTRY: IndustryDef = {
  slug: 'home-staging', label: 'Home Staging',
  keywords: ['home staging', 'real estate staging', 'house staging', 'virtual staging', 'staging consultation'],
  serviceGroups: ['Staging', 'Digital'],
  defaultThemes: ['media-creative', 'luxury-minimal', 'elegant-dressing', 'classic-warm'],
  defaultLayouts: ['gallery-showcase', 'before-after', 'portfolio-first', 'storyteller'],
  services: HOME_STAGING_SERVICES,
}
