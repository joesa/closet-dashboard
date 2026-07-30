import { describe, it, expect } from 'vitest';
import {
  detectVertical,
  getCraftFieldsForVertical,
  getTradeFallbackCraft,
  getMaterialsLabelAndPlaceholder,
} from './suggestCraftAnswers';

describe('suggestCraftAnswers vertical detection & fallbacks', () => {
  it('detects medical vertical for Pediatrics / Medical Care', () => {
    const vertical = detectVertical('Medical Care', ['Urgent Care Visit', 'Pediatrics'], 'Dental Office Visit');
    expect(vertical).toBe('medical');
  });

  it('detects professional vertical for Legal & Financial', () => {
    const vertical = detectVertical('Legal Services', ['Corporate Litigation', 'Tax Consulting']);
    expect(vertical).toBe('professional');
  });

  it('detects wellness vertical for Salon / Spa', () => {
    const vertical = detectVertical('Hair Salon & Spa', ['Facial Treatments', 'Hair Styling']);
    expect(vertical).toBe('wellness');
  });

  it('returns pediatric/medical care answers for Medical Care clinic', () => {
    const fallback = getTradeFallbackCraft('Medical Care', 'Clarksville, TN', ['Pediatrics', 'Urgent Care Visit']);
    expect(fallback.craftSpec).toContain('triage');
    expect(fallback.clientArtifact).toContain('care guide');
    expect(fallback.shopRule).toContain('sterilization');
    expect(fallback.recentJob).toContain('otitis media');
    expect(fallback.signatureMaterials).toContain('diagnostic sets');

    // Crucially: MUST NOT contain building/construction terms!
    const text = JSON.stringify(fallback).toLowerCase();
    expect(text).not.toContain('laser-level');
    expect(text).not.toContain('plywood');
    expect(text).not.toContain('cabinet');
    expect(text).not.toContain('foreman');
  });

  it('provides clinical field labels and placeholders for medical vertical', () => {
    const fields = getCraftFieldsForVertical('medical');
    const craftSpecField = fields.find((f) => f.key === 'craftSpec');
    expect(craftSpecField?.label).toContain('clinical practice');
    expect(craftSpecField?.placeholder).toContain('vitals');

    const materialsMeta = getMaterialsLabelAndPlaceholder('medical');
    expect(materialsMeta.label).toContain('Clinical tools');
    expect(materialsMeta.placeholder).toContain('diagnostic sets');
  });

  it('returns custom closet specific answers for closets trade', () => {
    const fallback = getTradeFallbackCraft('Custom Closets', 'Nashville');
    expect(fallback.craftSpec).toContain('1/4 inch');
    expect(fallback.clientArtifact).toContain('elevation');
    expect(fallback.signatureMaterials).toContain('Blum');
  });
});
