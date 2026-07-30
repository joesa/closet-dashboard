import { describe, it, expect } from 'vitest';
import {
  detectVertical,
  getCraftFieldsForVertical,
  getTradeFallbackCraft,
  getMaterialsLabelAndPlaceholder,
} from './suggestCraftAnswers';

describe('suggestCraftAnswers universal dynamic logic', () => {
  it('detects medical vertical for Pediatrics / Medical Care', () => {
    const vertical = detectVertical('Medical Care', ['Urgent Care Visit', 'Pediatrics']);
    expect(vertical).toBe('medical');
  });

  it('detects instruction vertical for Music Lessons / Daycare', () => {
    const vertical = detectVertical('Music School', ['Piano Lessons', 'Guitar Instruction']);
    expect(vertical).toBe('instruction');
  });

  it('detects creative vertical for Wedding Photography', () => {
    const vertical = detectVertical('Event Photography', ['Wedding Photo', 'Portrait Session']);
    expect(vertical).toBe('creative');
  });

  it('detects general_service for niche non-trade businesses like Equipment Rental', () => {
    const vertical = detectVertical('Equipment Rental', ['Scaffold Rental', 'Generator Rental']);
    expect(vertical).toBe('general_service');
  });

  it('guarantees ZERO construction/building terms in general_service fallback', () => {
    const fallback = getTradeFallbackCraft('Pet Grooming', 'Nashville', ['Dog Wash']);
    const text = JSON.stringify(fallback).toLowerCase();
    expect(text).not.toContain('laser');
    expect(text).not.toContain('plywood');
    expect(text).not.toContain('cabinet');
    expect(text).not.toContain('foreman');
    expect(text).not.toContain('framing');
    expect(fallback.craftSpec).toContain('track');
    expect(fallback.shopRule).toContain('24 hours');
  });

  it('returns pediatric care answers for Medical Care clinic', () => {
    const fallback = getTradeFallbackCraft('Medical Care', 'Clarksville, TN', ['Pediatrics', 'Urgent Care Visit']);
    expect(fallback.craftSpec).toContain('triage');
    expect(fallback.recentJob).toContain('otitis media');
    const text = JSON.stringify(fallback).toLowerCase();
    expect(text).not.toContain('laser-level');
    expect(text).not.toContain('plywood');
  });

  it('provides education field labels for instruction vertical', () => {
    const fields = getCraftFieldsForVertical('instruction');
    const specField = fields.find((f) => f.key === 'craftSpec');
    expect(specField?.label).toContain('student/child');

    const materials = getMaterialsLabelAndPlaceholder('instruction');
    expect(materials.label).toContain('Educational materials');
  });
});
