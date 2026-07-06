'use client';

import React, { useState } from 'react';
import type { IntakeTierCatalogEntry } from '@/lib/intake/tiers';
import {
  formatUsd,
  getSiteMaintenancePricing,
  maintenanceDisplay,
} from '@/lib/intake/tiers';
import { startIntakeCheckout } from '@/lib/intake/startIntakeCheckout';

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

  const saveMaintenance = async (plan: 'monthly' | 'yearly') => {
    try {
      await fetch(`/api/intake/${token}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: currentTier, maintenancePlan: plan }),
      });
    } catch {
      /* non-blocking */
    }
  };

  const selectTier = async (slug: string) => {
    if (slug === currentTier) return;
    setLoading(slug);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: slug, maintenancePlan: maintenanceBilling }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to set tier');
      onTierChange(json.tier, json.depositStatus, !!json.canUseImageStudio);

      if (
        slug === 'ai_premium' &&
        json.depositStatus !== 'paid' &&
        (json.depositRequiredCents ?? 0) > 0
      ) {
        await startIntakeCheckout(token, 'deposit');
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set tier');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
      <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
        Choose your setup package
      </h2>
      <p className="mb-4 text-xs text-zinc-400">
        Standard uses professional stock imagery. AI Premium generates custom hero and product photos during this form.
        Build fees are one-time; managed hosting + DitchTheForm Pro starts after launch.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-300">Site maintenance:</span>
        <div className="inline-flex rounded-full border border-white/[0.14] bg-white/[0.04] p-0.5">
          <button
            type="button"
            onClick={() => {
              setMaintenanceBilling('monthly');
              void saveMaintenance('monthly');
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              maintenanceBilling === 'monthly'
                ? 'bg-white text-black'
                : 'text-zinc-300'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => {
              setMaintenanceBilling('yearly');
              void saveMaintenance('yearly');
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              maintenanceBilling === 'yearly'
                ? 'bg-white text-black'
                : 'text-zinc-300'
            }`}
          >
            Yearly
          </button>
        </div>
        {maintenance.yearlySavingsCents > 0 && maintenanceBilling === 'yearly' && (
          <span className="text-xs font-medium text-emerald-300">
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
                  ? 'border-indigo-300 bg-indigo-500/10 ring-1 ring-indigo-300'
                  : 'border-white/[0.14] bg-white/[0.01] hover:border-indigo-300/50'
              }`}
            >
              <div className="font-semibold text-zinc-100">{t.label}</div>
              <div className="mt-1 text-lg font-bold text-indigo-200">
                {formatUsd(t.totalCents)}
                <span className="text-sm font-semibold text-indigo-200/90"> one-time build</span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                Then {formatUsd(maintDisplay.perMonthCents)}/mo — {maintDisplay.billedLabel}
              </p>
              {t.slug === 'standard' && (
                <p className="mt-2 rounded px-2 py-1.5 text-xs font-medium text-zinc-300 bg-white/[0.04]">
                  No upfront deposit. Pay {formatUsd(t.totalCents)} when satisfied with the preview,
                  then we launch and give you full dashboard access.
                </p>
              )}
              {t.slug === 'ai_premium' && t.depositCents > 0 && (
                <>
                  <p className="mt-2 rounded px-2 py-1 text-xs font-medium text-amber-100 bg-amber-500/15">
                    30% due today: {formatUsd(t.depositCents)} — unlocks AI studio. Balance{' '}
                    {formatUsd(t.remainderCents)} only if satisfied before launch.
                  </p>
                  <p className="mt-1 text-xs text-emerald-300">
                    Not satisfied? No balance — deposit returned.
                  </p>
                </>
              )}
              {loading === t.slug && (
                <p className="mt-2 text-xs text-zinc-500">Saving…</p>
              )}
            </button>
          );
        })}
      </div>
      {currentTier === 'ai_premium' && depositStatus !== 'paid' && depositStatus !== 'not_required' && (
        <p className="mt-3 text-xs text-amber-300">
          AI image studio unlocks after the 30% deposit is paid.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
