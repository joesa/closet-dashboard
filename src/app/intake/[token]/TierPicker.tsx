'use client';

import React, { useState } from 'react';
import type { IntakeTierCatalogEntry } from '@/lib/intake/tiers';
import {
  formatUsd,
  getSiteMaintenancePricing,
  maintenanceDisplay,
} from '@/lib/intake/tiers';

type Props = {
  token: string;
  catalog: IntakeTierCatalogEntry[];
  currentTier: string;
  depositStatus: string;
  onTierChange: (tier: string, depositStatus: string, canUseImageStudio: boolean) => void;
};

export default function TierPicker({
  token,
  catalog,
  currentTier,
  depositStatus,
  onTierChange,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [maintenanceBilling, setMaintenanceBilling] = useState<'monthly' | 'yearly'>('monthly');
  const maintenance = getSiteMaintenancePricing();
  const maintDisplay = maintenanceDisplay(maintenanceBilling, maintenance);

  const selectTier = async (slug: string) => {
    if (slug === currentTier) return;
    setLoading(slug);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: slug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to set tier');
      onTierChange(json.tier, json.depositStatus, !!json.canUseImageStudio);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set tier');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-900 mb-1">
        Choose your setup package
      </h2>
      <p className="text-xs text-indigo-800/80 mb-4">
        Standard uses professional stock imagery. AI Premium generates custom hero and product photos during this form.
        Build fees are one-time; managed hosting + ClosetQuote Pro starts after launch.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-indigo-900">Site maintenance:</span>
        <div className="inline-flex rounded-full border border-indigo-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setMaintenanceBilling('monthly')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              maintenanceBilling === 'monthly'
                ? 'bg-indigo-600 text-white'
                : 'text-indigo-700'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setMaintenanceBilling('yearly')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              maintenanceBilling === 'yearly'
                ? 'bg-indigo-600 text-white'
                : 'text-indigo-700'
            }`}
          >
            Yearly
          </button>
        </div>
        {maintenance.yearlySavingsCents > 0 && maintenanceBilling === 'yearly' && (
          <span className="text-xs text-emerald-700 font-medium">
            Save {formatUsd(maintenance.yearlySavingsCents)}/yr
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {catalog.map((t) => {
          const selected = currentTier === t.slug;
          return (
            <button
              key={t.slug}
              type="button"
              disabled={!!loading}
              onClick={() => void selectTier(t.slug)}
              className={`rounded-lg border p-4 text-left transition ${
                selected
                  ? 'border-indigo-600 bg-white ring-2 ring-indigo-500'
                  : 'border-gray-200 bg-white hover:border-indigo-300'
              }`}
            >
              <div className="font-semibold text-gray-900">{t.label}</div>
              <div className="mt-1 text-lg font-bold text-indigo-700">
                {formatUsd(t.totalCents)}
                <span className="text-sm font-semibold text-indigo-600/90"> one-time build</span>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                Then {formatUsd(maintDisplay.perMonthCents)}/mo — {maintDisplay.billedLabel}
              </p>
              {t.slug === 'ai_premium' && t.depositCents > 0 && (
                <p className="mt-2 text-xs font-medium text-amber-800 bg-amber-50 rounded px-2 py-1">
                  30% due today: {formatUsd(t.depositCents)} of {formatUsd(t.totalCents)} total.
                  Remainder {formatUsd(t.remainderCents)} due before launch.
                </p>
              )}
              {t.slug === 'standard' && (
                <p className="mt-2 text-xs text-gray-500">Stock hero &amp; product images. Fastest path.</p>
              )}
              {loading === t.slug && (
                <p className="mt-2 text-xs text-gray-500">Saving…</p>
              )}
            </button>
          );
        })}
      </div>
      {currentTier === 'ai_premium' && depositStatus !== 'paid' && depositStatus !== 'not_required' && (
        <p className="mt-3 text-xs text-amber-800">
          AI image studio unlocks after the 30% deposit is paid.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
