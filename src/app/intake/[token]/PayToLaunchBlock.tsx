'use client';

import React, { useState } from 'react';
import { formatUsd } from '@/lib/intake/tiers';
import type { IntakeCheckoutKind } from '@/lib/intake/intakePaymentStage';
import { startIntakeCheckout } from '@/lib/intake/startIntakeCheckout';

type Props = {
  token: string;
  paymentDueLabel: string;
  checkoutKind: IntakeCheckoutKind | null;
  canPay: boolean;
  amountCents?: number;
};

export default function PayToLaunchBlock({
  token,
  paymentDueLabel,
  checkoutKind,
  canPay,
  amountCents = 0,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!checkoutKind && !canPay) {
    return (
      <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        {paymentDueLabel}
      </div>
    );
  }

  const pay = async () => {
    if (!checkoutKind) return;
    setLoading(true);
    setError('');
    try {
      await startIntakeCheckout(token, checkoutKind);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setLoading(false);
    }
  };

  const buttonLabel =
    checkoutKind === 'maintenance'
      ? 'Start site maintenance'
      : amountCents > 0
        ? `Pay ${formatUsd(amountCents)}`
        : 'Pay now';

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-5">
      <h3 className="font-semibold text-indigo-900">Launch payments</h3>
      <p className="mt-1 text-sm text-indigo-800">{paymentDueLabel}</p>
      {canPay && checkoutKind && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void pay()}
          className="mt-4 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Redirecting…' : buttonLabel}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
