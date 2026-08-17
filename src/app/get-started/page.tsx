'use client';

import React, { useState, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      'timeout-callback'?: () => void;
    }
  ) => string | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function GetStartedForm() {
  const searchParams = useSearchParams();
  const tierParam = searchParams.get('tier');
  const selectedTier = tierParam === 'custom_studio' || tierParam === 'ai_premium'
    ? 'ai_premium'
    : tierParam === 'standard'
      ? 'standard'
      : undefined;
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasWebsite, setHasWebsite] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileFailed, setTurnstileFailed] = useState(false);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const tierHint =
    selectedTier === 'ai_premium'
      ? 'Custom Studio site build'
      : selectedTier === 'standard'
        ? 'Standard site build'
        : null;

  // Turnstile is rendered explicitly rather than by its implicit `.cf-turnstile`
  // scan. This page renders behind a Suspense boundary (useSearchParams), so the
  // container does not exist in the server HTML — the implicit scan ran against a
  // DOM without it, left no widget behind, and every submit logged
  // "[Cloudflare Turnstile] Could not find widget." from getResponse(). Rendering
  // from an effect means the container is guaranteed to be mounted first, and the
  // token arrives through the callback instead of being read back out of the widget.
  React.useEffect(() => {
    if (!siteKey) return;

    let cancelled = false;

    const renderWidget = () => {
      if (cancelled) return;
      const turnstile = window.turnstile;
      const container = turnstileRef.current;
      if (!turnstile || !container) {
        setTurnstileFailed(true);
        return;
      }
      if (widgetIdRef.current !== undefined) return;
      widgetIdRef.current = turnstile.render(container, {
        sitekey: siteKey,
        action: 'turnstile-spin-v2',
        callback: (token: string) => {
          setTurnstileToken(token);
          setTurnstileFailed(false);
        },
        'expired-callback': () => setTurnstileToken(''),
        'timeout-callback': () => setTurnstileToken(''),
        'error-callback': () => {
          setTurnstileToken('');
          setTurnstileFailed(true);
        },
      });
    };

    const onScriptError = () => {
      if (!cancelled) setTurnstileFailed(true);
    };

    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SRC}"]`
    );
    if (window.turnstile) {
      renderWidget();
    } else {
      if (!script) {
        script = document.createElement('script');
        script.src = TURNSTILE_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderWidget);
      script.addEventListener('error', onScriptError);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener('load', renderWidget);
      script?.removeEventListener('error', onScriptError);
      const turnstile = window.turnstile;
      if (turnstile && widgetIdRef.current !== undefined) {
        turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = undefined;
    };
  }, [siteKey]);

  // A Turnstile token is single-use: once the server has spent it, a retry needs
  // a fresh one or it fails verification a second time.
  const resetTurnstile = useCallback(() => {
    setTurnstileToken('');
    const turnstile = window.turnstile;
    if (turnstile && widgetIdRef.current !== undefined) {
      turnstile.reset(widgetIdRef.current);
    }
  }, []);

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

    const token = siteKey ? turnstileToken : '';

    try {
      if (siteKey && !token) {
        throw new Error(
          turnstileFailed
            ? 'The captcha could not load. Refresh the page and try again.'
            : 'Please complete the captcha and try again.'
        );
      }

      const res = await fetch('/api/intake/public/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          businessName,
          hasWebsite,
          tier: selectedTier,
          ...(token ? { turnstileToken: token } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      setSubmitted(true);
    } catch (err) {
      if (token) resetTurnstile();
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
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
              ? 'Resending…'
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
          {hasWebsite
            ? 'Enter your email and we will send you a short setup link for the quote widget that goes on the site you already have.'
            : 'Enter your email and we will send you a link to complete setup for your quote calculator and marketing site.'}
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
          <label className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={hasWebsite}
              onChange={(e) => setHasWebsite(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-gray-600">
              <span className="font-medium text-gray-800">I already have a website.</span>{' '}
              Set up the quote widget for it instead of building me a new site. The setup is
              shorter and there is no site build fee.
            </span>
          </label>

          {siteKey && (
            <div>
              <div ref={turnstileRef} />
              {turnstileFailed && (
                <p className="mt-2 text-xs text-red-600">
                  The captcha could not load. Refresh the page and try again.
                </p>
              )}
            </div>
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
          Already have a website? Tick the box above and we will send you the
          short setup — the quote widget only, sized for the site you already have.
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
