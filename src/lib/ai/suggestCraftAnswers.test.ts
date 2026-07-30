import { describe, it, expect } from 'vitest';
import { getTradeFallbackCraft } from './suggestCraftAnswers';

describe('suggestCraftAnswers trade fallbacks', () => {
  it('returns custom closet specific answers for closets trade', () => {
    const fallback = getTradeFallbackCraft('Custom Closets', 'Nashville');
    expect(fallback.craftSpec).toContain('1/4 inch');
    expect(fallback.clientArtifact).toContain('elevation');
    expect(fallback.signatureMaterials).toContain('Blum');
  });

  it('returns plumbing specific answers for plumbing trade', () => {
    const fallback = getTradeFallbackCraft('Plumbing & Heating', 'Austin');
    expect(fallback.craftSpec).toContain('camera-inspect');
    expect(fallback.signatureMaterials).toContain('Schedule-80');
  });

  it('returns HVAC specific answers for HVAC trade', () => {
    const fallback = getTradeFallbackCraft('HVAC Services', 'Dallas');
    expect(fallback.craftSpec).toContain('BTU');
    expect(fallback.shopRule).toContain('nitrogen-purge');
  });

  it('returns general trade answers when trade is unknown', () => {
    const fallback = getTradeFallbackCraft('Specialty Handyman', 'Denver');
    expect(fallback.craftSpec).toContain('laser-level');
    expect(fallback.shopRule).toContain('clean and vacuum');
  });
});
