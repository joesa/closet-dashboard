'use client';

import React, { useState, Suspense } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function GetStartedForm() {
  const searchParams = useSearchParams();
  const tierParam = searchParams.get('tier');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const tierHint =
    tierParam === 'ai_premium'
      ? 'AI Premium site build'
      : tierParam === 'standard'
        ? 'Standard site build'
        : null;

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const resendEmail = async () => {
    if (resending || resendCooldown > 0) return;
    setResending(true);
    setResendMessage('');
    try {
      const res = await fetch('/api/intake/public/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not resend right now');
      setResendMessage('Email resent — check your inbox.');
      setResendCooldown(30);
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : 'Could not resend right now');
    } finally {
      setResending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const turnstileToken =
        typeof window !== 'undefined' &&
        (window as unknown as { turnstile?: { getResponse: () => string } }).turnstile
          ? (window as unknown as { turnstile: { getResponse: () => string } }).turnstile.getResponse()
          : '';

      const res = await fetch('/api/intake/public/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          businessName,
          hasWebsite: false,
          tier: tierParam === 'ai_premium' || tierParam === 'standard' ? tierParam : undefined,
          turnstileToken: turnstileToken || 'dev-bypass',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      {siteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      )}
      {submitted ? (
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-indigo-600 text-2xl">✉</div>
          <h1 className="text-xl font-semibold text-gray-900">Check your email</h1>
          <p className="mt-2 text-sm text-gray-600">
            We sent a confirmation link to <strong>{email}</strong>.
            Click that link to open your setup form.
          </p>
          <p className="mt-4 text-xs text-gray-400">Didn&apos;t get it? Check your spam folder.</p>
          <button
            type="button"
            onClick={resendEmail}
            disabled={resending || resendCooldown > 0}
            className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            {resending
              ? 'Resending\u2026'
              : resendCooldown > 0
                ? `Resend confirmation email (${resendCooldown}s)`
                : 'Resend confirmation email'}
          </button>
          {resendMessage && (
            <p className="mt-2 text-xs text-gray-500">{resendMessage}</p>
          )}
        </div>
      ) : (
      <div className="admin-light-surface w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Get started with DitchTheForm</h1>
        {tierHint && (
          <p className="mt-2 text-sm font-medium text-indigo-700">
            You selected: {tierHint}. We&apos;ll pre-select this on your intake form.
          </p>
        )}
        <p className="mt-2 text-sm text-gray-500">
          Enter your email and we will send you a link to complete setup for your quote calculator
          and marketing site.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Work email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Business name (optional)</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Acme Service Co."
            />
          </div>
          {siteKey && (
            <div
              className="cf-turnstile"
              data-sitekey={siteKey}
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Email me the setup link'}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <p className="mt-4 text-center text-xs text-gray-500">
          Already have a website?{' '}
          <Link href="/signup?from=get-started" className="font-medium text-indigo-600 hover:underline">
            Leave this form and set up ClosetQuote Pro (widget only) →
          </Link>
        </p>

        <p className="mt-6 text-center text-xs text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Log in</Link>
        </p>
      </div>
      )}
    </div>
  );
}

export default function GetStartedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <GetStartedForm />
    </Suspense>
  );
}
