'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewIntakeButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    setLoading(true);
    setError('');
    setUrl('');
    try {
      const res = await fetch('/api/intake/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: businessName.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create link');
      setUrl(json.url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">Generate an intake link</h2>
      <p className="mt-1 text-xs text-gray-500">Create a shareable link and send it to the prospect. They fill in everything we need to build their site.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Business name (optional)"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={create}
          disabled={loading}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create link'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {url && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-gray-50 border border-gray-200 p-2">
          <code className="flex-1 truncate text-xs text-gray-700">{url}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
