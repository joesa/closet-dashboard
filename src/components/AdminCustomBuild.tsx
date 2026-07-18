'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = {
  renderMode: 'engine' | 'custom';
  customUpdatedAt?: string | null;
  draft: { mode: string; pageKeys: string[] } | null;
  published: { mode: string; pageKeys: string[] } | null;
};

/**
 * Admin panel: AI-build a completely custom HTML/CSS site for ONE tenant,
 * preview the draft, then publish (render_mode=custom) or revert to the
 * shared template engine. Other tenants are never affected.
 */
export default function AdminCustomBuild({
  tenantId,
  previewUrl,
}: {
  tenantId: string;
  previewUrl?: string | null;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'inline' | 'iframe'>('inline');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [info, setInfo] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/sites/${tenantId}/custom-build`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed to load status (${res.status})`);
      setStatus(json);
      if (json.draft?.mode === 'iframe' || json.draft?.mode === 'inline') {
        setMode(json.draft.mode);
      } else if (json.published?.mode === 'iframe' || json.published?.mode === 'inline') {
        setMode(json.published.mode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    }
  }, [tenantId]);

  // Avoid SSR/client text mismatches (React #418) by rendering dynamic status
  // only after mount; fetch runs client-side only.
  useEffect(() => {
    setMounted(true);
    void refresh();
  }, [refresh]);

  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    setLoading(true);
    setError('');
    setInfo('');
    setReply('');
    setWarnings([]);
    try {
      const res = await fetch(`/api/admin/sites/${tenantId}/custom-build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof json.error === 'string' ? json.error : `Request failed (${res.status})`;
        throw new Error(
          res.status === 504 || /timeout|timed out/i.test(detail)
            ? 'Generation timed out — try a shorter creative direction, or Generate again (drafts are smaller now).'
            : detail
        );
      }
      if (typeof json.reply === 'string') setReply(json.reply);
      if (Array.isArray(json.warnings)) setWarnings(json.warnings);
      if (action === 'publish') {
        setInfo(
          json.liveNow
            ? 'Published — custom site is live (cache busted).'
            : 'Published — may take up to ~60s for cache to refresh.'
        );
      } else if (action === 'revert') {
        setInfo('Reverted to the shared template engine for this site.');
      } else if (action === 'discard') {
        setInfo('Draft discarded.');
      }
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const draftPreviewUrl =
    previewUrl && status?.draft
      ? `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}draft=1`
      : null;

  return (
    <section className="bg-neutral-900 border border-violet-500/30 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-violet-300 uppercase tracking-widest">
            Custom build (from scratch)
          </h3>
          <p className="mt-1 text-sm text-neutral-400 max-w-2xl">
            AI generates a completely bespoke HTML/CSS site for <em>this tenant only</em>.
            Draft first → preview → publish. Other sites and the template engine stay untouched.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
              mounted && status?.renderMode === 'custom'
                ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}
            suppressHydrationWarning
          >
            Live:{' '}
            {!mounted
              ? '…'
              : status?.renderMode === 'custom'
                ? 'CUSTOM'
                : 'ENGINE'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg border border-neutral-800 bg-black/30 p-4">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Draft
          </div>
          {!mounted ? (
            <p className="text-neutral-500">Loading…</p>
          ) : status?.draft ? (
            <>
              <p className="text-neutral-200">
                Mode: <span className="font-mono text-violet-300">{status.draft.mode}</span>
              </p>
              <p className="text-neutral-400 mt-1">
                Pages: {status.draft.pageKeys.join(', ') || '(none)'}
              </p>
            </>
          ) : (
            <p className="text-neutral-500">No draft yet — generate one below.</p>
          )}
        </div>
        <div className="rounded-lg border border-neutral-800 bg-black/30 p-4">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Published
          </div>
          {!mounted ? (
            <p className="text-neutral-500">Loading…</p>
          ) : status?.published ? (
            <>
              <p className="text-neutral-200">
                Mode: <span className="font-mono text-violet-300">{status.published.mode}</span>
              </p>
              <p className="text-neutral-400 mt-1">
                Pages: {status.published.pageKeys.join(', ') || '(none)'}
              </p>
            </>
          ) : (
            <p className="text-neutral-500">Nothing published yet.</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
          Creative direction
        </label>
        <textarea
          className="w-full min-h-[100px] rounded-lg border border-neutral-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/60"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Bold editorial magazine layout, deep forest greens, large hero photography, sticky nav, services as a horizontal scroll — completely different from our usual engine look."
          disabled={loading}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <span className="text-xs text-neutral-500 uppercase">Mode</span>
          <select
            className="bg-black/50 border border-neutral-700 text-white text-sm rounded px-3 py-1.5"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'inline' | 'iframe')}
            disabled={loading}
          >
            <option value="inline">Inline (SEO, no JS)</option>
            <option value="iframe">Iframe (allows JS)</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() =>
            void run('generate', {
              prompt: prompt || 'Create a distinctive, conversion-focused custom site.',
              mode,
              iterate: false,
            })
          }
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Working…' : 'Generate from scratch'}
        </button>
        <button
          type="button"
          disabled={loading || !status?.draft}
          onClick={() =>
            void run('generate', {
              prompt: prompt || 'Improve the existing draft.',
              mode,
              iterate: true,
            })
          }
          className="px-4 py-2 border border-violet-400/40 hover:bg-violet-500/10 disabled:opacity-40 text-violet-200 text-sm font-medium rounded-lg transition-colors"
        >
          Iterate on draft
        </button>
        {draftPreviewUrl ? (
          <a
            href={draftPreviewUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 border border-amber-400/40 hover:bg-amber-500/10 text-amber-200 text-sm font-medium rounded-lg transition-colors"
          >
            Preview draft
          </a>
        ) : null}
        <button
          type="button"
          disabled={loading || !status?.draft}
          onClick={() => {
            if (!confirm('Publish this draft? The live site will switch to custom render mode.')) return;
            void run('publish');
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Publish draft
        </button>
        <button
          type="button"
          disabled={loading || status?.renderMode !== 'custom'}
          onClick={() => {
            if (!confirm('Revert this site to the shared template engine?')) return;
            void run('revert');
          }}
          className="px-4 py-2 border border-neutral-600 hover:bg-neutral-800 disabled:opacity-40 text-neutral-300 text-sm font-medium rounded-lg transition-colors"
        >
          Revert to engine
        </button>
        <button
          type="button"
          disabled={loading || !status?.draft}
          onClick={() => {
            if (!confirm('Discard the draft? This cannot be undone.')) return;
            void run('discard');
          }}
          className="px-4 py-2 border border-red-400/30 hover:bg-red-500/10 disabled:opacity-40 text-red-300 text-sm font-medium rounded-lg transition-colors ml-auto"
        >
          Discard draft
        </button>
      </div>

      {reply ? (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-violet-100 whitespace-pre-wrap">
          {reply}
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="text-xs text-amber-300/90 space-y-1 list-disc list-inside">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {info ? <p className="text-sm text-emerald-300">{info}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
