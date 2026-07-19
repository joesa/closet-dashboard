'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = {
  renderMode: 'engine' | 'custom';
  customUpdatedAt?: string | null;
  draft: { mode: string; pageKeys: string[] } | null;
  published: { mode: string; pageKeys: string[] } | null;
};

type CustomAsset = {
  name: string;
  path: string;
  url: string;
  size: number | null;
  contentType: string | null;
  kind: 'video' | 'image' | 'file';
  updatedAt: string | null;
};

/**
 * Admin panel: AI-build a completely custom HTML/CSS site for ONE tenant,
 * or surgically edit an existing custom draft/published site. Preview →
 * publish. Other tenants and the template engine stay untouched.
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
  const [changedPages, setChangedPages] = useState<string[]>([]);
  const [lastIntent, setLastIntent] = useState<'full' | 'surgical' | null>(null);
  const [assets, setAssets] = useState<CustomAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState<'video' | 'image' | 'file' | 'auto'>('auto');
  const [uploadApply, setUploadApply] = useState<'none' | 'video_home' | 'append_home'>('none');

  const hasBase = !!(status?.draft || status?.published);

  const refreshAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/sites/${tenantId}/custom-assets`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to list assets');
      setAssets(Array.isArray(json.assets) ? json.assets : []);
    } catch (err) {
      // Non-fatal for the rest of the panel
      console.warn(err);
    }
  }, [tenantId]);

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

  useEffect(() => {
    setMounted(true);
    void refresh();
    void refreshAssets();
  }, [refresh, refreshAssets]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError('');
    setInfo('');
    try {
      // Direct-to-Supabase for anything over ~3.5MB (Vercel body limit ~4.5MB).
      const useDirect = file.size > 3.5 * 1024 * 1024 || file.type.startsWith('video/');

      let url: string | undefined;
      let applied: string | null = null;

      if (useDirect) {
        const signRes = await fetch(`/api/admin/sites/${tenantId}/custom-assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sign',
            fileName: file.name,
            mime: file.type || 'application/octet-stream',
            size: file.size,
            kind: uploadKind === 'auto' ? undefined : uploadKind,
          }),
        });
        const signJson = await signRes.json().catch(() => ({}));
        if (!signRes.ok) {
          throw new Error(signJson.error || `Could not start upload (${signRes.status})`);
        }
        const u = signJson.upload as {
          signedUrl: string
          publicUrl: string
          path: string
          contentType: string
          kind: 'video' | 'image' | 'file'
          name: string
        };
        const putRes = await fetch(u.signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': u.contentType || file.type || 'application/octet-stream',
          },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Direct upload to storage failed (${putRes.status})`);
        }
        const completeRes = await fetch(`/api/admin/sites/${tenantId}/custom-assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            url: u.publicUrl,
            path: u.path,
            kind: u.kind,
            label: file.name,
            mime: u.contentType,
            size: file.size,
            apply: uploadApply,
          }),
        });
        const completeJson = await completeRes.json().catch(() => ({}));
        if (!completeRes.ok) {
          throw new Error(completeJson.error || `Finalize failed (${completeRes.status})`);
        }
        url = u.publicUrl;
        applied = completeJson.applied ?? null;
      } else {
        const fd = new FormData();
        fd.append('file', file);
        if (uploadKind !== 'auto') fd.append('kind', uploadKind);
        fd.append('apply', uploadApply);
        fd.append('label', file.name);
        const res = await fetch(`/api/admin/sites/${tenantId}/custom-assets`, {
          method: 'POST',
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
        url = json.asset?.url as string | undefined;
        applied = json.applied ?? null;
      }

      setInfo(
        applied === 'video_home'
          ? `Uploaded and set as home testimonial video.${url ? ` URL: ${url}` : ''}`
          : applied === 'append_home'
            ? `Uploaded and appended to the home page draft.${url ? ` URL: ${url}` : ''}`
            : `Uploaded to Supabase CDN.${url ? ` Copy this URL for surgical edits: ${url}` : ''}`
      );
      await refreshAssets();
      if (applied) {
        await refresh();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const applyExisting = async (
    asset: CustomAsset,
    apply: 'video_home' | 'append_home'
  ) => {
    setUploading(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch(`/api/admin/sites/${tenantId}/custom-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          url: asset.url,
          kind: asset.kind,
          label: asset.name,
          apply,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to apply asset');
      setInfo(
        apply === 'video_home'
          ? 'Set as home page video in the draft.'
          : 'Appended to the home page draft.'
      );
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply asset');
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setInfo('CDN URL copied to clipboard.');
    } catch {
      setInfo(url);
    }
  };

  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    setLoading(true);
    setError('');
    setInfo('');
    setReply('');
    setWarnings([]);
    setChangedPages([]);
    setLastIntent(null);
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
            ? 'Generation timed out — try a shorter, more specific prompt.'
            : detail
        );
      }
      if (typeof json.reply === 'string') setReply(json.reply);
      if (Array.isArray(json.warnings)) setWarnings(json.warnings);
      if (Array.isArray(json.changedPages)) setChangedPages(json.changedPages);
      if (json.intent === 'full' || json.intent === 'surgical') setLastIntent(json.intent);
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
      } else if (action === 'generate' && json.intent === 'surgical') {
        setInfo(
          Array.isArray(json.changedPages) && json.changedPages.length
            ? `Surgical edit saved to draft. Changed: ${json.changedPages.join(', ')}`
            : 'Surgical edit saved — no pages changed.'
        );
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
            Custom build
          </h3>
          <p className="mt-1 text-sm text-neutral-400 max-w-2xl">
            Build a bespoke HTML/CSS site for <em>this tenant only</em>, then make{' '}
            <strong className="text-neutral-300 font-medium">surgical edits</strong> without
            redesigning the whole site. Draft → preview → publish.
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

      <div className="rounded-lg border border-neutral-800 bg-black/30 p-4 space-y-3">
        <div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Media &amp; files (Supabase CDN)
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Upload videos, images, or docs for this custom site. Files land in{' '}
            <code className="text-neutral-400">site-assets/custom/{'{tenantId}'}/</code> and
            get a permanent public URL you can paste into surgical edits.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-neutral-300">
            <span className="block text-xs text-neutral-500 uppercase mb-1">Type</span>
            <select
              className="bg-black/50 border border-neutral-700 text-white text-sm rounded px-3 py-1.5"
              value={uploadKind}
              onChange={(e) =>
                setUploadKind(e.target.value as 'video' | 'image' | 'file' | 'auto')
              }
              disabled={uploading || loading}
            >
              <option value="auto">Auto-detect</option>
              <option value="video">Video</option>
              <option value="image">Image</option>
              <option value="file">File / doc</option>
            </select>
          </label>
          <label className="text-sm text-neutral-300">
            <span className="block text-xs text-neutral-500 uppercase mb-1">After upload</span>
            <select
              className="bg-black/50 border border-neutral-700 text-white text-sm rounded px-3 py-1.5"
              value={uploadApply}
              onChange={(e) =>
                setUploadApply(e.target.value as 'none' | 'video_home' | 'append_home')
              }
              disabled={uploading || loading}
            >
              <option value="none">Upload only (copy URL)</option>
              <option value="video_home">Set as home video src</option>
              <option value="append_home">Append to home page</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600/80 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
            {uploading ? 'Uploading…' : 'Choose file'}
            <input
              type="file"
              className="hidden"
              disabled={uploading || loading}
              accept={
                uploadKind === 'video'
                  ? 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov'
                  : uploadKind === 'image'
                    ? 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml'
                    : uploadKind === 'file'
                      ? '.pdf,.doc,.docx,.txt,.csv,.json,.zip,application/pdf'
                      : 'video/*,image/*,.pdf,.doc,.docx,.txt,.csv,.json,.zip'
              }
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void uploadFile(f);
              }}
            />
          </label>
        </div>

        {assets.length > 0 ? (
          <ul className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden">
            {assets.slice(0, 12).map((a) => (
              <li
                key={a.path}
                className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm bg-black/20"
              >
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                    a.kind === 'video'
                      ? 'bg-rose-500/20 text-rose-300'
                      : a.kind === 'image'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-neutral-700 text-neutral-300'
                  }`}
                >
                  {a.kind}
                </span>
                <span className="text-neutral-200 truncate min-w-0 flex-1" title={a.name}>
                  {a.name}
                </span>
                <button
                  type="button"
                  className="text-xs text-violet-300 hover:text-violet-200"
                  onClick={() => void copyUrl(a.url)}
                  disabled={uploading}
                >
                  Copy URL
                </button>
                {a.kind === 'video' ? (
                  <button
                    type="button"
                    className="text-xs text-amber-300 hover:text-amber-200 disabled:opacity-40"
                    disabled={uploading || !hasBase}
                    onClick={() => void applyExisting(a, 'video_home')}
                  >
                    Use as home video
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-40"
                  disabled={uploading || !hasBase}
                  onClick={() => void applyExisting(a, 'append_home')}
                >
                  Append to home
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-600">No uploads yet for this site.</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
          What should AI do?
        </label>
        <textarea
          className="w-full min-h-[100px] rounded-lg border border-neutral-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/60"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            hasBase
              ? 'Surgical: e.g. “Simplify the hero headline to Welcome to Acme” or “Change the CTA to Get a free quote” — do not redesign.'
              : 'Full build: e.g. Bold editorial layout, deep forest greens, large hero photo…'
          }
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
          disabled={loading || !hasBase || !prompt.trim()}
          onClick={() =>
            void run('generate', {
              prompt: prompt.trim(),
              mode,
              intent: 'surgical',
            })
          }
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          title={
            hasBase
              ? 'Apply only the requested change to the existing custom site'
              : 'Generate a custom site first'
          }
        >
          {loading ? 'Working…' : 'Edit surgically'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (
              hasBase &&
              !confirm(
                'Full redesign will rebuild the entire custom site (new layout/CSS). Continue?'
              )
            ) {
              return;
            }
            void run('generate', {
              prompt:
                prompt.trim() ||
                'Create a distinctive, conversion-focused custom site.',
              mode,
              intent: 'full',
            });
          }}
          className="px-4 py-2 border border-violet-400/40 hover:bg-violet-500/10 disabled:opacity-50 text-violet-200 text-sm font-medium rounded-lg transition-colors"
        >
          {hasBase ? 'Full redesign' : 'Generate from scratch'}
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

      {lastIntent ? (
        <p className="text-xs text-neutral-500">
          Last run: <span className="text-violet-300 font-mono">{lastIntent}</span>
          {changedPages.length > 0 ? (
            <>
              {' '}
              · changed pages:{' '}
              <span className="text-neutral-300 font-mono">{changedPages.join(', ')}</span>
            </>
          ) : null}
        </p>
      ) : null}

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
