'use client';

import React, { useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';

export default function GetStartedPage() {
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [hasWebsite, setHasWebsite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

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
          hasWebsite,
          turnstileToken: turnstileToken || 'dev-bypass',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      setMessage(json.message || 'Check your email for a link to continue.');
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
        <p className="mt-2 text-sm text-gray-500">
          Enter your email and we will send you a link to complete setup for your quote calculator
          {hasWebsite ? '' : ' and marketing site'}.
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
            I already have a website (widget embed only)
          </label>

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

        {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <p className="mt-6 text-center text-xs text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
