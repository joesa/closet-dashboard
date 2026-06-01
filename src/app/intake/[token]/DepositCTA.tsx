'use client';

import React, { useState } from 'react';
import { formatUsd } from '@/lib/intake/tiers';

type Props = {
  token: string;
  depositRequiredCents: number;
  depositStatus: string;
  totalCents: number;
};

export default function DepositCTA({
  token,
  depositRequiredCents,
  depositStatus,
  totalCents,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (depositStatus === 'paid' || depositRequiredCents <= 0) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Deposit received — AI image studio is unlocked.
      </div>
    );
  }

  const pay = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}/checkout`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Checkout failed');
      if (json.url) window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <h3 className="font-semibold text-amber-900">Pay 30% deposit to continue</h3>
      <p className="mt-1 text-sm text-amber-800">
        AI Premium requires {formatUsd(depositRequiredCents)} today (30% of {formatUsd(totalCents)}) to
        unlock the image studio. The remaining {formatUsd(totalCents - depositRequiredCents)} is only
        due if you&apos;re satisfied before launch. Not satisfied? You don&apos;t pay the balance — your
        deposit is returned.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void pay()}
        className="mt-4 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50"
      >
        {loading ? 'Redirecting…' : `Pay ${formatUsd(depositRequiredCents)} now`}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
