'use client';

import React, { useMemo, useState } from 'react';
import type { IntakeImageSelections } from '@/lib/intake/imageSelections';

type SiteConfigShape = {
  hero?: { imagePrompt?: string; headline?: string };
  products?: Array<{ title?: string; imagePrompt?: string; description?: string }>;
};

type Props = {
  token: string;
  services: string[];
  aiSiteConfig: SiteConfigShape | null;
  imageSelections: IntakeImageSelections;
  onUpdate: (selections: IntakeImageSelections, siteConfig: SiteConfigShape | null) => void;
};

export default function IntakeImageStudio({
  token,
  services,
  aiSiteConfig: initialSite,
  imageSelections: initialSelections,
  onUpdate,
}: Props) {
  const [siteConfig, setSiteConfig] = useState<SiteConfigShape | null>(initialSite);
  const [selections, setSelections] = useState(initialSelections);
  const [briefLoading, setBriefLoading] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const products = useMemo(() => {
    const fromAi = siteConfig?.products ?? [];
    return services.map((name, i) => {
      const match = fromAi.find((p) => p.title === name) ?? fromAi[i];
      return {
        serviceName: name,
        index: i,
        prompt: match?.imagePrompt ?? '',
        description: match?.description ?? '',
      };
    });
  }, [services, siteConfig]);

  const heroPrompt = siteConfig?.hero?.imagePrompt ?? '';

  const runBrief = async () => {
    setBriefLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}/generate-site`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Brief generation failed');
      const sc = (json.data?.siteConfig ?? json.data) as SiteConfigShape;
      setSiteConfig(sc);
      onUpdate(selections, sc);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Brief generation failed');
    } finally {
      setBriefLoading(false);
    }
  };

  const generateBatch = async (
    slot: 'hero' | 'product',
    prompt: string,
    productIndex?: number
  ) => {
    const key = slot === 'hero' ? 'hero' : `product-${productIndex}`;
    setGenLoading(key);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}/generate-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, prompt, productIndex }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Image generation failed');
      const res2 = await fetch(`/api/intake/${token}`);
      const refreshed = await res2.json();
      if (refreshed.imageSelections) {
        setSelections(refreshed.imageSelections);
        onUpdate(refreshed.imageSelections, siteConfig);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image generation failed');
    } finally {
      setGenLoading(null);
    }
  };

  const selectImage = async (
    slot: 'hero' | 'product',
    selectedUrl: string,
    attempt: number,
    productIndex?: number
  ) => {
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}/image-selection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, selectedUrl, attempt, productIndex }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save selection');
      setSelections(json.imageSelections);
      onUpdate(json.imageSelections, siteConfig);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save selection');
    }
  };

  const renderSlot = (
    label: string,
    slot: 'hero' | 'product',
    prompt: string,
    onPromptChange: (v: string) => void,
    slotState: IntakeImageSelections['hero'] | IntakeImageSelections['products'][0],
    productIndex?: number
  ) => {
    const attemptsUsed = slotState.attemptsUsed ?? 0;
    const max = 3;
    const lastBatch = slotState.history?.[slotState.history.length - 1];

    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="font-medium text-gray-900">{label}</h4>
        <p className="text-xs text-gray-500 mt-1">
          Up to {max} generations of 3 options each. Attempts used: {attemptsUsed}/{max}.
        </p>
        <label className="block text-xs font-medium text-gray-600 mt-3 mb-1">
          Image description (art direction)
        </label>
        <textarea
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 min-h-[72px]"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
        />
        <button
          type="button"
          disabled={!!genLoading || !prompt.trim() || attemptsUsed >= max}
          onClick={() => void generateBatch(slot, prompt, productIndex)}
          className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {genLoading === (slot === 'hero' ? 'hero' : `product-${productIndex}`)
            ? 'Generating 3 options…'
            : 'Generate 3 options'}
        </button>
        {slotState.selectedUrl && (
          <p className="mt-2 text-xs text-green-700 font-medium">Selected for your site.</p>
        )}
        {lastBatch && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {lastBatch.urls.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => void selectImage(slot, url, lastBatch.attempt, productIndex)}
                className={`rounded border overflow-hidden ${
                  slotState.selectedUrl === url ? 'ring-2 ring-indigo-600' : 'border-gray-300'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-20 object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-indigo-200 bg-white p-6 space-y-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
          AI image studio
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Generate custom hero and product photos. Pick one image from each batch of three.
        </p>
      </div>

      {!siteConfig && (
        <button
          type="button"
          disabled={briefLoading}
          onClick={() => void runBrief()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {briefLoading ? 'Building AI brief…' : 'Generate AI brief from your answers'}
        </button>
      )}

      {siteConfig && (
        <>
          {renderSlot(
            'Hero image',
            'hero',
            heroPrompt,
            (v) => setSiteConfig((s) => ({ ...s, hero: { ...s?.hero, imagePrompt: v } })),
            selections.hero
          )}
          {products.map((p) => {
            const slotState =
              selections.products.find((x) => x.productIndex === p.index) ?? {
                serviceName: p.serviceName,
                productIndex: p.index,
                attemptsUsed: 0,
                history: [],
              };
            return (
              <div key={p.serviceName}>
                {renderSlot(
                  `Product: ${p.serviceName}`,
                  'product',
                  p.prompt,
                  (v) => {
                    setSiteConfig((s) => {
                      const prods = [...(s?.products ?? [])];
                      const idx = prods.findIndex((x) => x.title === p.serviceName);
                      if (idx >= 0) prods[idx] = { ...prods[idx], imagePrompt: v };
                      else prods[p.index] = { title: p.serviceName, imagePrompt: v };
                      return { ...s, products: prods };
                    });
                  },
                  slotState,
                  p.index
                )}
              </div>
            );
          })}
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
