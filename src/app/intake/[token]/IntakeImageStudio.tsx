'use client';

import React, { useMemo, useState } from 'react';
import type { IntakeImageSelections } from '@/lib/intake/imageSelections';
import { buildBeforeImagePrompt, getBeforeAfterCategory } from '@/lib/images/beforeAfterPrompt';
import { resolveIndustrySlug } from '@/lib/catalog/serviceCatalog';

type StudioSlot = 'hero' | 'product' | 'before';

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
  formState?: any;
  isActive?: boolean;
};

// Optional richer art direction for storage / organization verticals, where
// naming specific finishes noticeably improves realism. Returns null for any
// other trade so the prompt falls back to industry-neutral language instead of
// forcing closet-style materials onto, say, a plumber or tow operator.
function storageVerticalMaterials(name: string): string | null {
  if (/garage/.test(name)) {
    return (
      'powder-coated steel slatwall panels, heavy-duty epoxy floor coating, stainless overhead storage, ' +
      'matte-black track hardware, built-in workbench with hardwood butcher-block surface'
    );
  }
  if (/pantry|wine|cellar/.test(name)) {
    return (
      'rift-cut white oak open shelving, brushed brass rails, pull-out wicker baskets, ' +
      'integrated LED under-shelf lighting, honed marble countertops, recessed spice niches'
    );
  }
  if (/mudroom|mud room|laundry|entryway/.test(name)) {
    return (
      'painted shaker cabinetry, matte-black hooks, teak bench slats, wainscoting panels, ' +
      'cubbies with linen fabric baskets, integrated LED lighting'
    );
  }
  if (/office|desk|library/.test(name)) {
    return (
      'walnut veneer shelving, fluted glass cabinet doors, matte-black anodized hardware, ' +
      'integrated LED task lighting, cable-management channels, floating desk surface'
    );
  }
  if (/closet|wardrobe|dressing|reach-in|reach in/.test(name)) {
    return (
      'rift-cut white oak, matte-black anodized hardware, brushed brass rails, integrated LED shelf lighting, ' +
      'soft-close drawers with precision joinery'
    );
  }
  return null;
}

function defaultProductPrompt(serviceName: string): string {
  const name = serviceName.toLowerCase();
  const materials = storageVerticalMaterials(name);

  if (materials) {
    return (
      `Authentic real interior photograph, tight close-up of a beautifully organized ${name} ` +
      `installation. Featuring real premium materials (${materials}), natural grain and subtle ` +
      `lived-in imperfections. Shot on a full-frame DSLR with a 35mm lens, ` +
      `natural window light, photorealistic, 8k, crisp textures, wide 16:9 composition. NOT a 3D render, ` +
      `NOT CGI, not digital art — avoid plastic/glossy surfaces, waxy textures, and uncanny symmetry. ` +
      `No text, no logos.`
    );
  }

  // Industry-neutral fallback: photograph the finished, professional result of
  // whatever service the business actually performs.
  return (
    `Authentic real photograph documenting professional, completed ${name} work — a clean, ` +
    `well-executed result shown in a true-to-life setting with realistic detail and natural wear. ` +
    `Shot on a full-frame DSLR with a 35mm lens, natural light, photorealistic, 8k, crisp textures, ` +
    `wide 16:9 composition. NOT a 3D render, NOT CGI, not digital art — avoid plastic/glossy surfaces, ` +
    `waxy textures, and uncanny symmetry. No text, no logos.`
  );
}

function defaultHeroPrompt(serviceName: string): string {
  const name = (serviceName || 'professional service').toLowerCase();
  const materials = storageVerticalMaterials(name);

  if (materials) {
    return (
      `Authentic real-estate / architectural photograph, a grand wide-angle view of an immaculate ` +
      `${name} installation. Featuring real premium materials, custom cabinetry, backlit shelving, and ` +
      `luxury finishes in a bright residential space. Shot on a full-frame DSLR with a 24mm lens, ` +
      `natural window light with soft realistic shadows, photorealistic, 8k, crisp focus, clean lines, ` +
      `clutter-free, wide 16:9 composition. NOT a 3D render, NOT CGI, not digital art — avoid ` +
      `plastic/glossy surfaces, waxy textures, warped geometry, and uncanny perfect symmetry. ` +
      `No text, no logos.`
    );
  }

  // Industry-neutral hero: a clean, inviting, real-world scene that conveys the
  // quality and trustworthiness of the business, whatever the trade.
  return (
    `Authentic real photograph representing a professional ${name} business — a clean, inviting, ` +
    `real-world scene that conveys quality, craftsmanship, and trust. Shot on a full-frame DSLR ` +
    `with a 24mm lens, natural light with soft realistic shadows, photorealistic, 8k, crisp focus, ` +
    `clean composition, wide 16:9. NOT a 3D render, NOT CGI, not digital art — avoid plastic/glossy ` +
    `surfaces, waxy textures, warped geometry, and uncanny perfect symmetry. No text, no logos.`
  );
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Words that are too generic to prove a stored hero prompt matches the
// contractor's current trade/service (e.g. "install" can match anything).
const GENERIC_SERVICE_WORDS = new Set([
  'install',
  'installation',
  'repair',
  'replace',
  'replacement',
  'service',
  'services',
  'maintenance',
  'clean',
  'cleaning',
  'upgrade',
  'upgrades',
  'inspection',
  'inspections',
  'system',
  'systems',
  'unit',
  'units',
  'job',
  'jobs',
  'work',
  'professional',
]);

function serviceSpecificKeywords(services: string[]): string[] {
  const out = new Set<string>();
  services.forEach((svc) => {
    normalizeName(svc)
      .split(' ')
      .filter((w) => w.length >= 4 && !GENERIC_SERVICE_WORDS.has(w))
      .forEach((w) => out.add(w));
  });
  return [...out];
}

export default function IntakeImageStudio({
  token,
  services,
  pages = [],
  aiSiteConfig: initialSite,
  imageSelections: initialSelections,
  onUpdate,
  formState,
  isActive,
}: Props) {
  const [siteConfig, setSiteConfig] = useState<SiteConfigShape | null>(initialSite);
  const [selections, setSelections] = useState(initialSelections);
  const [briefLoading, setBriefLoading] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    url: string;
    slot: StudioSlot;
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

  const heroPrompt = (() => {
    const stored = siteConfig?.hero?.imagePrompt?.trim();
    if (stored && services.length > 0) {
      const lower = stored.toLowerCase();
      // Reuse stored hero art direction only when it mentions trade-specific
      // keywords from current services. Generic verbs like "install" / "repair"
      // are ignored, so stale prompts from another trade (e.g. HVAC) don't
      // survive just because they contain "installation".
      const keywords = serviceSpecificKeywords(services);
      const isRelevant =
        keywords.length > 0
          ? keywords.some((word) => lower.includes(word))
          : services.some((svc) =>
              normalizeName(svc)
                .split(' ')
                .filter((w) => w.length >= 4)
                .some((word) => lower.includes(word))
            );
      if (isRelevant) return stored;
    }
    return defaultHeroPrompt(services[0] ?? '');
  })();

  // Editable art direction for the "before" transformation shot. Defaults to
  // the same trade-aware degradation prompt provisioning would use, derived
  // from the selected hero ("after") image.
  const [beforePromptOverride, setBeforePromptOverride] = useState<string | null>(null);
  const beforeState = selections.beforeAfter ?? { attemptsUsed: 0, history: [] };

  // Not every business has a physical "before" state (restaurants, legal,
  // medical, booking businesses…) — for those the site never renders a
  // transformation slider, so the whole before/after section is hidden. The
  // server's answer (which also knows about contractor-created custom
  // industries in the DB) arrives with the AI brief; until then fall back to
  // the same static catalog classification computed client-side.
  const [serverBeforeAfterApplicable, setServerBeforeAfterApplicable] = useState<boolean | null>(
    null
  );
  const beforeAfterApplicable =
    serverBeforeAfterApplicable ??
    getBeforeAfterCategory(
      resolveIndustrySlug({
        industry: (formState?.industry as string) || null,
        services,
        other_services: (formState?.otherServices as string) || null,
      })
    ) !== 'not-applicable';
  const beforePrompt =
    beforePromptOverride ??
    beforeState.prompt ??
    buildBeforeImagePrompt(selections.hero.selectedUrl || '', {
      industry: (formState?.industry as string) || null,
      services,
      otherServices: (formState?.otherServices as string) || null,
    });

  const runBrief = async () => {
    setBriefLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}/generate-site`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages, ...formState }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Brief generation failed');
      const sc = (json.data?.siteConfig ?? json.data) as SiteConfigShape;
      setSiteConfig(sc);
      if (typeof json.beforeAfterApplicable === 'boolean') {
        setServerBeforeAfterApplicable(json.beforeAfterApplicable);
      }
      onUpdate(selections, sc);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Brief generation failed');
    } finally {
      setBriefLoading(false);
    }
  };

  // Auto-trigger brief when this step becomes active
  React.useEffect(() => {
    if (isActive && !siteConfig && !briefLoading) {
      void runBrief();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, siteConfig, briefLoading]);

  const generateBatch = async (
    slot: StudioSlot,
    prompt: string,
    productIndex?: number
  ) => {
    const key = slot === 'hero' ? 'hero' : slot === 'before' ? 'before' : `product-${productIndex}`;
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

  // Auto-trigger sequential image generation
  const [autoGenStarted, setAutoGenStarted] = useState(false);
  
  React.useEffect(() => {
    if (!isActive || !siteConfig || autoGenStarted) return;
    
    const runSequentialGen = async () => {
      setAutoGenStarted(true);
      
      // Hero
      if (!selections.hero.selectedUrl && (selections.hero.attemptsUsed ?? 0) === 0) {
        await generateBatch('hero', heroPrompt);
      }
      
      // Products
      for (const p of products) {
        const slotState = selections.products.find((x) => x.serviceName === p.serviceName);
        if (!slotState?.selectedUrl && (slotState?.attemptsUsed ?? 0) === 0) {
          await generateBatch('product', p.prompt, p.index);
        }
      }
    };
    
    void runSequentialGen();
  }, [isActive, siteConfig, autoGenStarted, selections, products, heroPrompt]);

  const selectImage = async (
    slot: StudioSlot,
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
      // First hero pick: kick off the matching "before" batch automatically
      // (empty prompt = server builds the trade-aware default from the hero).
      const ba = json.imageSelections?.beforeAfter;
      if (slot === 'hero' && !ba?.selectedUrl && (ba?.attemptsUsed ?? 0) === 0) {
        void generateBatch('before', '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save selection');
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: StudioSlot,
    productIndex?: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const attemptRecord = {
        attempt: (Date.now() % 1000000), // unique pseudo-attempt ID
        urls: [dataUrl],
        prompt: 'Custom user upload',
      };

      let newSelections: IntakeImageSelections;
      if (slot === 'hero') {
        newSelections = {
          ...selections,
          hero: {
            ...selections.hero,
            selectedUrl: dataUrl,
            selectedAttempt: attemptRecord.attempt,
            history: [...(selections.hero.history || []), attemptRecord],
          },
        };
      } else if (slot === 'before') {
        const beforeState = selections.beforeAfter ?? { attemptsUsed: 0, history: [] };
        newSelections = {
          ...selections,
          beforeAfter: {
            ...beforeState,
            selectedUrl: dataUrl,
            selectedAttempt: attemptRecord.attempt,
            history: [...(beforeState.history || []), attemptRecord],
          },
        };
      } else {
        const productsList = [...selections.products];
        const idx = productsList.findIndex((p) => p.productIndex === productIndex);
        if (idx >= 0) {
          productsList[idx] = {
            ...productsList[idx],
            selectedUrl: dataUrl,
            selectedAttempt: attemptRecord.attempt,
            history: [...(productsList[idx].history || []), attemptRecord],
          };
        } else if (productIndex !== undefined) {
          productsList.push({
            serviceName: products[productIndex]?.serviceName || `Service ${productIndex}`,
            productIndex,
            attemptsUsed: 0,
            selectedUrl: dataUrl,
            selectedAttempt: attemptRecord.attempt,
            history: [attemptRecord],
          });
        }
        newSelections = { ...selections, products: productsList };
      }

      setSelections(newSelections);
      onUpdate(newSelections, siteConfig);

      try {
        const res = await fetch(`/api/intake/${token}/image-selection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newSelections, serviceNames: services }),
        });
        const json = await res.json();
        if (res.ok && json.imageSelections) {
          setSelections(json.imageSelections);
          onUpdate(json.imageSelections, siteConfig);
        }
      } catch (err) {
        console.error('Failed to save custom upload to server', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const renderSlot = (
    label: string,
    slot: StudioSlot,
    prompt: string,
    onPromptChange: (v: string) => void,
    slotState: IntakeImageSelections['hero'] | IntakeImageSelections['products'][0],
    productIndex?: number
  ) => {
    const attemptsUsed = slotState.attemptsUsed ?? 0;
    const max = 5;
    const lastBatch = slotState.history?.[slotState.history.length - 1];
    const genKey = slot === 'hero' ? 'hero' : slot === 'before' ? 'before' : `product-${productIndex}`;
    const generateDisabled =
      !!genLoading ||
      !prompt.trim() ||
      attemptsUsed >= max ||
      (slot === 'before' && !selections.hero.selectedUrl);

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
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={generateDisabled}
            onClick={() => void generateBatch(slot, prompt, productIndex)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {genLoading === genKey
              ? 'Generating 3 options…'
              : 'Generate 3 options'}
          </button>
          
          <label
            className={`rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold ${
              !!genLoading
                ? 'cursor-not-allowed bg-gray-100 text-gray-400 opacity-50'
                : 'cursor-pointer bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Upload own image
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={!!genLoading}
              onChange={(e) => handleFileUpload(e, slot, productIndex)}
            />
          </label>
        </div>
        {attemptsUsed >= max && (
          <p className="mt-2 text-xs text-gray-500">
            No generations remaining for this{' '}
            {slot === 'hero' ? 'hero image' : slot === 'before' ? 'before image' : 'product'}.
          </p>
        )}
        {slot === 'before' && !selections.hero.selectedUrl && (
          <p className="mt-2 text-xs text-amber-700">
            Select a hero image first — the AI derives the “before” photo from it so both sides of
            the slider show the same scene.
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
          id="btn-build-ai-brief"
          type="button"
          disabled={briefLoading}
          onClick={() => void runBrief()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {briefLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Building AI brief…
            </span>
          ) : (
            'Generate AI brief from your answers'
          )}
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

          {beforeAfterApplicable && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
            <h4 className="font-medium text-gray-900">Before / after transformation</h4>
            <p className="mt-1 text-xs text-gray-600">
              Your site shows a drag-to-compare slider: the “after” side is your selected hero
              image, and the AI creates the matching “before” photo of the exact same scene in its
              pre-service state. Generate options below, edit the description first if you like, or
              upload your own real before photo instead.
            </p>
            {selections.hero.selectedUrl && (
              <div className="mt-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selections.hero.selectedUrl}
                  alt="After (hero)"
                  className="h-16 w-24 rounded border border-gray-300 object-cover"
                />
                <span className="text-xs text-gray-600">
                  “After” side of the slider (your hero image)
                </span>
              </div>
            )}
            <div className="mt-3">
              {renderSlot(
                'Before photo',
                'before',
                beforePrompt,
                (v) => setBeforePromptOverride(v),
                beforeState
              )}
            </div>
          </div>
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
