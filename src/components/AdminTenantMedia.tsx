'use client';

import { useCallback, useEffect, useState } from 'react';

type MediaKind = 'all' | 'image' | 'video' | 'file';

type Asset = {
  name: string;
  path: string;
  url: string;
  size: number | null;
  contentType: string | null;
  kind: 'video' | 'image' | 'file';
  updatedAt: string | null;
  source: 'custom' | 'engine';
};

type Counts = { all: number; image: number; video: number; file: number };

function formatBytes(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Admin media library for one tenant: list every image/video/file on the
 * Supabase CDN (custom uploads + provisioned engine assets) with filter tabs
 * and one-click copy of URLs.
 */
export default function AdminTenantMedia({ tenantId }: { tenantId: string }) {
  const [kind, setKind] = useState<MediaKind>('all');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, image: 0, video: 0, file: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/admin/sites/${tenantId}/custom-assets?kind=${encodeURIComponent(kind)}`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed to load media (${res.status})`);
      setAssets(Array.isArray(json.assets) ? json.assets : []);
      if (json.counts && typeof json.counts === 'object') {
        setCounts({
          all: Number(json.counts.all) || 0,
          image: Number(json.counts.image) || 0,
          video: Number(json.counts.video) || 0,
          file: Number(json.counts.file) || 0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [tenantId, kind]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copyOne = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setInfo('URL copied.');
    } catch {
      setInfo(url);
    }
  };

  const copyAll = async () => {
    const text = assets.map((a) => a.url).join('\n');
    if (!text) {
      setInfo('No URLs to copy for this filter.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setInfo(`Copied ${assets.length} URL${assets.length === 1 ? '' : 's'}.`);
    } catch {
      setInfo(text);
    }
  };

  const tabs: { id: MediaKind; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'image', label: `Images (${counts.image})` },
    { id: 'video', label: `Videos (${counts.video})` },
    { id: 'file', label: `Files (${counts.file})` },
  ];

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
            Media library
          </h3>
          <p className="mt-1 text-sm text-neutral-400 max-w-2xl">
            All admin-uploaded images, videos, and files for this tenant on Supabase CDN —
            plus provisioned engine images. Filter by type and copy URLs for surgical edits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => void copyAll()}
            disabled={loading || assets.length === 0}
            className="px-3 py-1.5 text-sm rounded-lg bg-violet-600/80 hover:bg-violet-500 text-white disabled:opacity-40"
          >
            Copy all URLs
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setKind(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              kind === t.id
                ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                : 'bg-black/30 text-neutral-400 border-neutral-800 hover:border-neutral-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {info ? <p className="text-xs text-emerald-400/90">{info}</p> : null}

      {loading && assets.length === 0 ? (
        <p className="text-sm text-neutral-500">Loading media…</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No {kind === 'all' ? 'media' : `${kind}s`} found for this tenant yet. Upload from Custom
          Build → Media &amp; files.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden max-h-[28rem] overflow-y-auto">
          {assets.map((a) => (
            <li
              key={a.path}
              className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-3 text-sm bg-black/20"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {a.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.url}
                    alt=""
                    className="h-12 w-16 shrink-0 rounded object-cover border border-neutral-700 bg-black"
                  />
                ) : a.kind === 'video' ? (
                  <div className="h-12 w-16 shrink-0 rounded border border-neutral-700 bg-neutral-950 flex items-center justify-center text-[10px] uppercase text-rose-300">
                    Video
                  </div>
                ) : (
                  <div className="h-12 w-16 shrink-0 rounded border border-neutral-700 bg-neutral-950 flex items-center justify-center text-[10px] uppercase text-neutral-400">
                    File
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-neutral-100 font-medium truncate" title={a.name}>
                      {a.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                        a.kind === 'video'
                          ? 'bg-rose-500/20 text-rose-300'
                          : a.kind === 'image'
                            ? 'bg-sky-500/20 text-sky-300'
                            : 'bg-neutral-700 text-neutral-300'
                      }`}
                    >
                      {a.kind}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase text-neutral-500 border border-neutral-800">
                      {a.source}
                    </span>
                    {a.size != null ? (
                      <span className="text-[11px] text-neutral-500">{formatBytes(a.size)}</span>
                    ) : null}
                  </div>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 block text-xs text-violet-300/90 hover:text-violet-200 break-all font-mono"
                  >
                    {a.url}
                  </a>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copyOne(a.url)}
                className="shrink-0 self-start sm:self-center px-3 py-1.5 text-xs rounded-lg border border-violet-500/30 text-violet-200 hover:bg-violet-500/10"
              >
                Copy URL
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
