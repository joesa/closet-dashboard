'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  leadId: string;
  businessName: string | null;
  email: string | null;
  pipeline: string | null;
};

export default function SendIntakeButton({ leadId, businessName, email, pipeline }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');

  const send = async () => {
    if (!email) {
      alert('This lead has no email address.');
      return;
    }
    setLoading(true);
    setUrl('');
    try {
      const res = await fetch('/api/intake/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scraperLeadId: leadId,
          businessName: businessName || undefined,
          recipientEmail: email,
          sendEmail: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setUrl(json.url);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send intake');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={send}
        disabled={loading || !email}
        title={!email ? 'No email on lead' : `Pipeline ${pipeline ?? 'B'} → intake`}
        className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-40"
      >
        {loading ? 'Sending…' : 'Send intake'}
      </button>
      {url && (
        <button
          type="button"
          className="text-xs text-gray-500 hover:underline max-w-[140px] truncate"
          onClick={() => navigator.clipboard.writeText(url)}
          title={url}
        >
          Copy link
        </button>
      )}
    </div>
  );
}
