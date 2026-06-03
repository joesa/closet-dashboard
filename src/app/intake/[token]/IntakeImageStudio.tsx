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
  pages?: string[];
  aiSiteConfig: SiteConfigShape | null;
  imageSelections: IntakeImageSelections;
  onUpdate: (selections: IntakeImageSelections, siteConfig: SiteConfigShape | null) => void;
};

function defaultProductPrompt(serviceName: string): string {
  const name = serviceName.toLowerCase();

  // Derive service-appropriate materials so the fallback prompt matches the
  // actual product being photographed instead of always referencing closet finishes.
  const isGarage = /garage/.test(name);
  const isPantry = /pantry|wine|cellar/.test(name);
  const isMudroom = /mudroom|mud room|laundry|entryway/.test(name);
  const isOffice = /office|desk|library/.test(name);

  let materials: string;
  if (isGarage) {
    materials =
      'powder-coated steel slatwall panels, heavy-duty epoxy floor coating, stainless overhead storage, ' +
      'matte-black track hardware, built-in workbench with hardwood butcher-block surface';
  } else if (isPantry) {
    materials =
      'rift-cut white oak open shelving, brushed brass rails, pull-out wicker baskets, ' +
      'integrated LED under-shelf lighting, honed marble countertops, recessed spice niches';
  } else if (isMudroom) {
    materials =
      'painted shaker cabinetry, matte-black hooks, teak bench slats, wainscoting panels, ' +
      'cubbies with linen fabric baskets, integrated LED lighting';
  } else if (isOffice) {
    materials =
      'walnut veneer shelving, fluted glass cabinet doors, matte-black anodized hardware, ' +
      'integrated LED task lighting, cable-management channels, floating desk surface';
  } else {
    // Default: closet / wardrobe
    materials =
      'rift-cut white oak, matte-black anodized hardware, brushed brass rails, integrated LED shelf lighting, ' +
      'soft-close drawers with precision joinery';
  }

  return (
    `Authentic real interior photograph, tight close-up of a beautifully organized ${name} ` +
    `installation. Featuring real premium materials (${materials}), natural grain and subtle ` +
    `lived-in imperfections. Shot on a full-frame DSLR with a 35mm lens, ` +
    `natural window light, photorealistic, 8k, crisp textures, wide 16:9 composition. NOT a 3D render, ` +
    `NOT CGI, not digital art — avoid plastic/glossy surfaces, waxy textures, and uncanny symmetry. ` +
    `No text, no people, no logos.`
  );
}

function defaultHeroPrompt(serviceName: string): string {
  const name = (serviceName || 'custom closet').toLowerCase();
  return (
    `Authentic real-estate / architectural photograph, a grand wide-angle view of an immaculate ` +
    `${name} installation. Featuring real premium materials, custom cabinetry, backlit shelving, and ` +
    `luxury finishes in a bright residential space. Shot on a full-frame DSLR with a 24mm lens, ` +
    `natural window light with soft realistic shadows, photorealistic, 8k, crisp focus, clean lines, ` +
    `clutter-free, wide 16:9 composition. NOT a 3D render, NOT CGI, not digital art — avoid ` +
    `plastic/glossy surfaces, waxy textures, warped geometry, and uncanny perfect symmetry. ` +
    `No text, no people, no logos.`
  );
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export default function IntakeImageStudio({
  token,
  services,
  pages = [],
  aiSiteConfig: initialSite,
  imageSelections: initialSelections,
  onUpdate,
}: Props) {
  const [siteConfig, setSiteConfig] = useState<SiteConfigShape | null>(initialSite);
  const [selections, setSelections] = useState(initialSelections);
  const [briefLoading, setBriefLoading] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    url: string;
    slot: 'hero' | 'product';
    attempt: number;
    productIndex?: number;
    isSelected: boolean;
  } | null>(null);

  const products = useMemo(() => {
    const fromAi = siteConfig?.products ?? [];
    return services.map((name, i) => {
      // Match the AI product by title only — never fall back positionally, as
      // that assigns an unrelated product's art direction (e.g. a pantry prompt
      // to "Dressing Rooms"). Without a confident match, use a service-specific
      // default prompt instead.
      const target = normalizeName(name);
      const match =
        fromAi.find((p) => p.title && normalizeName(p.title) === target) ??
        fromAi.find(
          (p) =>
            p.title &&
            (normalizeName(p.title).includes(target) ||
              target.includes(normalizeName(p.title)))
        );
      return {
        serviceName: name,
        index: i,
        prompt: match?.imagePrompt?.trim() || defaultProductPrompt(name),
        description: match?.description ?? '',
      };
    });
  }, [services, siteConfig]);

  const heroPrompt =
    siteConfig?.hero?.imagePrompt?.trim() || defaultHeroPrompt(services[0] ?? '');

  const runBrief = async () => {
    setBriefLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}/generate-site`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages }),
      });
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
        body: JSON.stringify({ slot, prompt, productIndex, serviceNames: services }),
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
      const message = e instanceof Error ? e.message : 'Image generation failed';
      // The slot's disabled button + inline note already communicate an
      // exhausted-attempts state, so don't surface it as a scary studio error.
      if (!/no .*attempts? remaining/i.test(message)) {
        setError(message);
      }
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
        body: JSON.stringify({ slot, selectedUrl, attempt, productIndex, serviceNames: services }),
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
        {attemptsUsed >= max && (
          <p className="mt-2 text-xs text-gray-500">
            No generations remaining for this {slot === 'hero' ? 'hero image' : 'product'}.
          </p>
        )}
        {slotState.selectedUrl && (
          <p className="mt-2 text-xs text-green-700 font-medium">Selected for your site.</p>
        )}
        {lastBatch && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {lastBatch.urls.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() =>
                  setPreview({
                    url,
                    slot,
                    attempt: lastBatch.attempt,
                    productIndex,
                    isSelected: slotState.selectedUrl === url,
                  })
                }
                title="Click to preview larger"
                className={`group relative rounded border overflow-hidden ${
                  slotState.selectedUrl === url ? 'ring-2 ring-indigo-600' : 'border-gray-300'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-20 object-cover" />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-semibold text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                  Preview
                </span>
                {slotState.selectedUrl === url && (
                  <span className="absolute right-1 top-1 rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                    ✓
                  </span>
                )}
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
              selections.products.find((x) => x.serviceName === p.serviceName) ?? {
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

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[90vh] w-auto flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt="Preview"
              className="rounded-lg object-contain shadow-2xl"
              style={{ width: '75vw', maxWidth: '75vh', maxHeight: '75vh' }}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void selectImage(
                    preview.slot,
                    preview.url,
                    preview.attempt,
                    preview.productIndex
                  );
                  setPreview(null);
                }}
                disabled={preview.isSelected}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {preview.isSelected ? 'Selected for your site' : 'Select this image'}
              </button>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-md border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
