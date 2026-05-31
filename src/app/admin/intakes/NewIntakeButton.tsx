'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const inputClass =
  'w-full min-w-[200px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500';

export default function NewIntakeButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [manualBuild, setManualBuild] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    setLoading(true);
    setError('');
    setUrl('');
    setEmailSent(false);
    try {
      const email = prospectEmail.trim().toLowerCase();
      const res = await fetch('/api/intake/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim() || undefined,
          recipientEmail: email || undefined,
          sendEmail: !!email,
          provisioningMode: manualBuild ? 'manual' : 'auto',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create link');
      setUrl(json.url);
      setEmailSent(!!json.emailSent);
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
      <p className="mt-1 text-xs text-gray-500">
        Add the prospect&apos;s email to send the link automatically (Resend), or leave email blank and copy the link yourself.
        Choose manual AI for high-touch builds (no auto template after submit).
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-gray-600">Business name (optional)</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Apex Garage Builds"
            className={inputClass}
          />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="mb-1 block text-xs font-medium text-gray-600">Prospect email</label>
          <input
            type="email"
            value={prospectEmail}
            onChange={(e) => setProspectEmail(e.target.value)}
            placeholder="owner@company.com"
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={manualBuild}
            onChange={(e) => setManualBuild(e.target.checked)}
          />
          Hold for manual AI build
        </label>
        <button
          onClick={create}
          disabled={loading}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Creating…' : prospectEmail.trim() ? 'Create & email link' : 'Create link'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {url && (
        <div className="mt-3 space-y-2">
          {emailSent && (
            <p className="text-sm text-green-700">
              Intake link emailed to {prospectEmail.trim()}.
            </p>
          )}
          {!emailSent && (
            <p className="text-xs text-gray-500">
              No email sent — copy the link below and send it to the prospect.
            </p>
          )}
          <div className="flex items-center gap-2 rounded-md bg-gray-50 border border-gray-200 p-2">
            <code className="flex-1 truncate text-xs text-gray-700">{url}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
