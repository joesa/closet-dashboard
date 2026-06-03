'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function GetStartedForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tierParam = searchParams.get('tier');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [hasWebsite, setHasWebsite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (hasWebsite) {
      router.replace('/signup?from=get-started');
    }
  }, [hasWebsite, router]);

  const tierHint =
    tierParam === 'ai_premium'
      ? 'AI Premium site build'
      : tierParam === 'standard'
        ? 'Standard site build'
        : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasWebsite) {
      router.push('/signup?from=get-started');
      return;
    }
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
      router.push('/');
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
      <div className="admin-light-surface w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Get started with ClosetQuote</h1>
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
              placeholder="Apex Garage Builds"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hasWebsite}
              onChange={(e) => setHasWebsite(e.target.checked)}
            />
            I already have a website (widget only — self-serve signup)
          </label>
          {hasWebsite && (
            <p className="text-xs text-indigo-700">
              Redirecting you to{' '}
              <Link href="/signup?from=get-started" className="underline">
                free trial signup
              </Link>{' '}
              — no intake email needed for widget-only.
            </p>
          )}

          {siteKey && (
            <div
              className="cf-turnstile"
              data-sitekey={siteKey}
            />
          )}

          <button
            type="submit"
            disabled={loading || hasWebsite}
            className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Email me the setup link'}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <p className="mt-6 text-center text-xs text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Log in</Link>
        </p>
      </div>
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
