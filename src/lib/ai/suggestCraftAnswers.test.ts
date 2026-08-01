import { afterEach, describe, it, expect, vi } from 'vitest';
import { generateTextWithFallback } from './aiTextProvider';
import {
  detectVertical,
  getCraftFieldsForVertical,
  getTradeFallbackCraft,
  getMaterialsLabelAndPlaceholder,
  suggestCraftAnswers,
} from './suggestCraftAnswers';

vi.mock('./aiTextProvider', () => ({
  generateTextWithFallback: vi.fn(),
}));

const mockedGenerate = vi.mocked(generateTextWithFallback);

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
});

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

  it('regenerates only a failing field and preserves clean answers', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const initial = {
      craftSpec: 'Elevate every patient visit.',
      clientArtifact: 'Families receive a same-day visit summary.',
      shopRule: 'We reserve two sick-visit slots each morning.',
      localConditions: 'School outbreaks fill local waiting rooms by noon.',
      recentJob: 'We diagnosed an ear infection during a same-day visit.',
      timelineFacts: 'Same-day visits are available before 4 p.m.',
      crewShape: 'A pediatrician and registered nurse handle each visit.',
      competitorTell: 'Rotating clinicians force families to repeat their history.',
      guaranteeTerms: 'Parents receive a callback before the clinic closes.',
      signatureMaterials: 'Welch Allyn diagnostic tools and Epic records.',
    };
    mockedGenerate
      .mockResolvedValueOnce({ text: JSON.stringify(initial), provider: 'gemini', model: 'test' })
      .mockResolvedValueOnce({
        text: JSON.stringify({ craftSpec: 'We record vitals before the pediatrician enters.' }),
        provider: 'gemini',
        model: 'test',
      });

    const result = await suggestCraftAnswers({
      industry: 'Pediatrics',
      services: ['Sick visits'],
      serviceArea: 'Clarksville',
    });

    expect(result.quality.status).toBe('passed');
    expect(result.quality.attempts).toBe(2);
    expect(result.answers.craftSpec).toBe('We record vitals before the pediatrician enters.');
    expect(result.answers.clientArtifact).toBe(initial.clientArtifact);
    expect(mockedGenerate).toHaveBeenCalledTimes(2);
    expect(mockedGenerate.mock.calls[1]?.[0].prompt).toContain(
      'exactly these keys: craftSpec'
    );
    expect(mockedGenerate.mock.calls[1]?.[0].prompt).not.toContain(
      `clientArtifact: ${initial.clientArtifact}`
    );
  });
});
