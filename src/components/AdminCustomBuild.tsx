'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MAX_ADMIN_IMAGE_ATTACHMENTS,
  fileToAdminImageDataUrl,
} from '@/lib/adminImageAttach';

type CustomBuildJob = {
  status: 'queued' | 'processing' | 'succeeded' | 'failed';
  intent?: 'full' | 'surgical';
  prompt?: string;
  error?: string | null;
  reply?: string | null;
  warnings?: string[];
  changedPages?: string[];
  started_at?: string;
  finished_at?: string | null;
};

type Status = {
  renderMode: 'engine' | 'custom';
  customUpdatedAt?: string | null;
  draft: { mode: string; pageKeys: string[] } | null;
  published: { mode: string; pageKeys: string[] } | null;
  draftAhead?: boolean;
  draftDiffPages?: string[];
  job?: CustomBuildJob | null;
  jobActive?: boolean;
  /** True once this tenant has ever started a Full redesign. */
  fullRedesignEver?: boolean;
};

type NextStep = {
  preview: boolean;
  publish: boolean;
  message: string;
};

type CustomAsset = {
  name: string;
  path: string;
  url: string;
  size: number | null;
  contentType: string | null;
  kind: 'video' | 'image' | 'file';
  updatedAt: string | null;
  source?: 'custom' | 'engine';
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
  const [lastIntent, setLastIntent] = useState<'full' | 'surgical' | 'clone' | null>(null);
  const [nextStep, setNextStep] = useState<NextStep | null>(null);
  const [assets, setAssets] = useState<CustomAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState<'video' | 'image' | 'file' | 'auto'>('auto');
  const [uploadApply, setUploadApply] = useState<'none' | 'video_home' | 'append_home'>('none');
  const [attachments, setAttachments] = useState<string[]>([]);
  const promptFileRef = useRef<HTMLInputElement>(null);

  const hasBase = !!(status?.draft || status?.published);

  const addPromptImages = async (files: FileList | File[]) => {
    setError('');
    try {
      const imageFiles = [...files].filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      const room = MAX_ADMIN_IMAGE_ATTACHMENTS - attachments.length;
      if (imageFiles.length > room) {
        setError(`Up to ${MAX_ADMIN_IMAGE_ATTACHMENTS} images per request.`);
      }
      const dataUrls = await Promise.all(
        imageFiles.slice(0, room).map((f) => fileToAdminImageDataUrl(f))
      );
      if (dataUrls.length) setAttachments((prev) => [...prev, ...dataUrls]);
    } catch {
      setError('Could not read that image — try a PNG or JPEG.');
    }
  };

  const refreshAssets = useCallback(async () => {
    try {
      // Custom uploads only here (engine images live in Media library below).
      const res = await fetch(`/api/admin/sites/${tenantId}/custom-assets?engine=0&kind=all`);
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

  // Poll while a Full redesign is running in the background.
  const jobWasActiveRef = useRef(false);
  useEffect(() => {
    const job = status?.job;
    const active =
      status?.jobActive || job?.status === 'queued' || job?.status === 'processing';
    if (active) {
      jobWasActiveRef.current = true;
      setLoading(true);
      setInfo(
        job?.status === 'processing'
          ? 'Full redesign in progress (Claude Fable 5, usually 3–5 minutes)…'
          : 'Full redesign queued…'
      );
      const id = window.setInterval(() => {
        void refresh();
      }, 4000);
      return () => window.clearInterval(id);
    }

    // Only surface terminal state when we observed this job running in-session
    // (avoid replaying an old succeeded/failed job every page load).
    if (!jobWasActiveRef.current || !job) return;
    jobWasActiveRef.current = false;

    if (job.status === 'succeeded') {
      setLoading(false);
      setError('');
      if (typeof job.reply === 'string' && job.reply.trim()) setReply(job.reply);
      if (Array.isArray(job.warnings)) setWarnings(job.warnings);
      if (Array.isArray(job.changedPages)) setChangedPages(job.changedPages);
      setLastIntent('full');
      setInfo(
        'Full redesign saved to DRAFT only. Preview draft → Publish draft. The public site stays unchanged until Publish.'
      );
      setNextStep({
        preview: true,
        publish: true,
        message:
          'Draft ready. Click Preview draft to review, then Publish draft to make it live.',
      });
    } else if (job.status === 'failed') {
      setLoading(false);
      setError(job.error || 'Full redesign failed — try again.');
      setInfo('');
    }
  }, [status?.jobActive, status?.job, refresh]);

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
    setNextStep(null);
    const imagesForRequest =
      action === 'generate' && attachments.length > 0 ? attachments : undefined;
    try {
      const res = await fetch(`/api/admin/sites/${tenantId}/custom-build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...extra,
          ...(imagesForRequest ? { images: imagesForRequest } : {}),
        }),
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
      if (imagesForRequest) setAttachments([]);
      if (typeof json.reply === 'string') setReply(json.reply);
      if (Array.isArray(json.warnings)) setWarnings(json.warnings);
      if (Array.isArray(json.changedPages)) setChangedPages(json.changedPages);
      if (json.intent === 'full' || json.intent === 'surgical' || json.intent === 'clone') {
        setLastIntent(json.intent);
      }
      if (json.nextStep && typeof json.nextStep === 'object') {
        setNextStep(json.nextStep as NextStep);
      }
      if (action === 'publish') {
        setInfo(
          typeof json.reply === 'string'
            ? json.reply
            : json.liveNow
              ? 'Published — custom site is live (cache busted). Open the public site (hard refresh).'
              : 'Published — may take up to ~60s for cache to refresh. Hard-refresh the public site.'
        );
      } else if (action === 'revert') {
        setInfo(
          json.liveNow === false
            ? 'Reverted to the shared template engine, but site cache bust failed — visitors may see the custom site for up to ~60s.'
            : 'Reverted to the shared template engine for this site.'
        );
      } else if (action === 'discard') {
        setInfo('Draft discarded.');
      } else if (action === 'clone') {
        setInfo(
          typeof json.reply === 'string'
            ? json.reply
            : 'Cloned the current live site into the custom draft.'
        );
      } else if (action === 'generate' && json.async) {
        // Full redesign runs in the background — keep loading + poll via refresh.
        setInfo(
          typeof json.reply === 'string'
            ? json.reply
            : 'Full redesign started — usually 3–5 minutes. This panel will update when ready.'
        );
        await refresh();
        router.refresh();
        // Don't clear loading here — the poll effect owns it until the job finishes.
        return;
      } else if (action === 'generate' && json.intent === 'full') {
        setInfo(
          'Full redesign saved to DRAFT only. Preview draft → Publish draft. The public site stays unchanged until Publish.'
        );
      } else if (action === 'generate' && json.intent === 'surgical') {
        setInfo(
          Array.isArray(json.changedPages) && json.changedPages.length
            ? `Surgical edit saved to DRAFT (${json.changedPages.join(', ')}). Preview draft to verify, then Publish draft to update the live site.`
            : 'Surgical edit saved — no pages changed.'
        );
      }
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  const draftPreviewUrl =
    previewUrl && status?.draft
      ? `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}draft=1`
      : null;

  const liveSiteUrl = previewUrl
    ? previewUrl.split('?')[0].replace(/\/$/, '') || previewUrl
    : null;

  const draftAhead = !!(status?.draftAhead ?? (status?.draft && status.renderMode !== 'custom'));
  const diffPages = status?.draftDiffPages || [];
  const isLivePublished =
    status?.renderMode === 'custom' && !!status.published && !draftAhead;
  // Full redesign is powerful/expensive — hide until this tenant has started
  // one at least once. New sites (!hasBase) can still start via this button.
  const showFullRedesign =
    !hasBase || !!(status?.fullRedesignEver || status?.job?.intent === 'full');

  const pagePreviewUrl = (path: string) => {
    if (!draftPreviewUrl) return null;
    try {
      const u = new URL(draftPreviewUrl);
      u.pathname = path === '/' ? '/' : path;
      return u.toString();
    } catch {
      return draftPreviewUrl;
    }
  };

  return (
    <section className="bg-neutral-900 border border-violet-500/30 rounded-xl p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-violet-300 uppercase tracking-widest">
            Custom build
          </h3>
          <p className="mt-1 text-sm text-neutral-400 max-w-2xl">
            Start by cloning this tenant’s <em>current live site</em> into a draft, then make{' '}
            <strong className="text-neutral-300 font-medium">surgical edits</strong>
            {showFullRedesign ? (
              <>
                . Use Full redesign for a new AI design — intake services stay unless you
                explicitly remove them; services named in the brief are added to the site
                and engagement engine
              </>
            ) : null}
            . Draft → preview → publish.
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

      {mounted && status?.draft && draftAhead ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 space-y-2">
          <p>
            <strong className="font-semibold text-amber-200">
              {status.renderMode === 'custom'
                ? 'Draft is ahead of the live site.'
                : 'Draft is not live yet.'}
            </strong>{' '}
            {status.renderMode === 'custom'
              ? 'Visitors still see the last published version until you Publish again.'
              : 'The public site still shows the template engine until you Publish.'}
            {diffPages.length > 0 ? (
              <>
                {' '}
                Unpublished changes on:{' '}
                <span className="font-mono text-amber-50">{diffPages.join(', ')}</span>
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            {draftPreviewUrl ? (
              <a
                href={draftPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-50 text-xs font-medium hover:bg-amber-500/30"
              >
                1. Preview draft
              </a>
            ) : null}
            {diffPages
              .filter((p) => p.startsWith('/'))
              .slice(0, 4)
              .map((p) => {
                const href = pagePreviewUrl(p);
                return href ? (
                  <a
                    key={p}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex px-3 py-1.5 rounded-lg border border-amber-400/30 text-amber-100/90 text-xs font-mono hover:bg-amber-500/15"
                  >
                    Preview {p}
                  </a>
                ) : null;
              })}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (!confirm('Publish draft to the live site now?')) return;
                void run('publish');
              }}
              className="inline-flex px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-40"
            >
              2. Publish draft
            </button>
          </div>
        </div>
      ) : null}

      {nextStep ? (
        <div className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-100 space-y-2">
          <p>
            <strong className="text-sky-200">Next step:</strong> {nextStep.message}
          </p>
          <div className="flex flex-wrap gap-2">
            {nextStep.preview && draftPreviewUrl ? (
              <a
                href={
                  changedPages[0]?.startsWith('/')
                    ? pagePreviewUrl(changedPages[0]) || draftPreviewUrl
                    : draftPreviewUrl
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-50 text-xs font-medium hover:bg-sky-500/30"
              >
                Open preview
                {changedPages[0]?.startsWith('/') ? ` (${changedPages[0]})` : ''}
              </a>
            ) : null}
            {nextStep.publish ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (!confirm('Publish draft to the live site now?')) return;
                  void run('publish');
                }}
                className="inline-flex px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-40"
              >
                Publish draft now
              </button>
            ) : null}
            {!nextStep.preview && !nextStep.publish && liveSiteUrl ? (
              <a
                href={liveSiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex px-3 py-1.5 rounded-lg border border-sky-400/40 text-sky-50 text-xs font-medium hover:bg-sky-500/20"
              >
                Open live site
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

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
          <ul className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            {assets.map((a) => (
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
                <div className="min-w-0 flex-1">
                  <div className="text-neutral-200 truncate" title={a.name}>
                    {a.name}
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono truncate" title={a.url}>
                    {a.url}
                  </div>
                </div>
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
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((src, i) => (
              <div key={`${i}-${src.slice(-12)}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Attachment ${i + 1}`}
                  className="h-16 w-16 rounded-md border border-neutral-700 object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  disabled={loading}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-neutral-600 bg-neutral-800 text-xs text-neutral-300 hover:bg-red-500/80 hover:text-white disabled:opacity-40"
                  aria-label={`Remove attachment ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={promptFileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void addPromptImages(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            aria-label="Attach image"
            title="Attach or paste a screenshot / reference image"
            onClick={() => promptFileRef.current?.click()}
            disabled={loading || attachments.length >= MAX_ADMIN_IMAGE_ATTACHMENTS}
            className="self-start rounded-lg border border-neutral-700 bg-black/50 px-3 py-3 text-sm text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
              />
            </svg>
          </button>
          <textarea
            className="min-h-[100px] w-full flex-1 rounded-lg border border-neutral-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/60"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={(e) => {
              const files = [...e.clipboardData.items]
                .filter((item) => item.type.startsWith('image/'))
                .map((item) => item.getAsFile())
                .filter((f): f is File => !!f);
              if (files.length) {
                e.preventDefault();
                void addPromptImages(files);
              }
            }}
            placeholder={
              hasBase
                ? 'Full redesign brief or surgical edit. e.g. “Swiss editorial, charcoal + copper — keep intake services, add ceramic coating, keep the quote engine.” Attach/paste a reference image if you have one.'
                : 'Optional Full redesign brief (style, mood, references). Attach/paste an image, then Generate from scratch or Full redesign. Intake services stay; brief may add services to site + engine.'
            }
            disabled={loading}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-600">
          Paste (Ctrl/Cmd+V) or attach up to {MAX_ADMIN_IMAGE_ATTACHMENTS} images — used as visual
          references for Full redesign and surgical edits.
        </p>
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
          disabled={loading || !hasBase || (!prompt.trim() && attachments.length === 0)}
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
                'Replace the current draft with a fresh clone of the live site? Surgical work in the draft will be overwritten.'
              )
            ) {
              return;
            }
            void run('clone', { mode });
          }}
          className="px-4 py-2 border border-violet-400/40 hover:bg-violet-500/10 disabled:opacity-50 text-violet-200 text-sm font-medium rounded-lg transition-colors"
          title="Copy the current live site into the custom draft (no AI redesign)"
        >
          {hasBase ? 'Re-clone live site' : 'Generate from scratch'}
        </button>
        {showFullRedesign ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (
                !confirm(
                  'Full redesign asks AI for an entirely new layout/CSS (not a copy of the live site). Continue?'
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
            className="px-4 py-2 border border-neutral-600 hover:bg-neutral-800 disabled:opacity-50 text-neutral-300 text-sm font-medium rounded-lg transition-colors"
            title="AI invents a new design — only use when you want a drastic change"
          >
            Full redesign
          </button>
        ) : null}
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
          disabled={loading || !status?.draft || isLivePublished}
          onClick={() => {
            if (!confirm('Publish this draft? The live site will switch to custom render mode.')) return;
            void run('publish');
          }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            isLivePublished
              ? 'bg-emerald-900/50 border border-emerald-500/40 text-emerald-200 cursor-default'
              : `bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white ${
                  draftAhead ? 'ring-2 ring-emerald-300/70 ring-offset-2 ring-offset-neutral-900' : ''
                }`
          }`}
          title={
            isLivePublished
              ? 'Draft matches the live published site'
              : draftAhead
                ? 'Draft has unpublished changes — click to push them live'
                : 'Publish the current draft to the live site'
          }
        >
          {isLivePublished
            ? 'Published'
            : draftAhead
              ? 'Publish draft (updates live)'
              : 'Publish draft'}
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
