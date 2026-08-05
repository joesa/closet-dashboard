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
      <div className="rounded-xl border border-[#E7E8E8] bg-[#F4F5F4] px-4 py-3 text-sm text-[#4E5761]">
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
    <div className="landing-shadow-card rounded-2xl border border-[#2438C9]/25 bg-[#EDEFFB] p-5">
      <h3 className="font-semibold text-[#10141A]">Launch payments</h3>
      <p className="mt-1 text-sm text-[#4E5761]">{paymentDueLabel}</p>
      {canPay && checkoutKind && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void pay()}
          className="mt-4 rounded-full bg-[#2438C9] px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-85 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Redirecting…' : buttonLabel}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
