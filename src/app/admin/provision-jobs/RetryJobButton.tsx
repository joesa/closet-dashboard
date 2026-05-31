'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RetryJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const retry = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/provision-jobs/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Retry failed');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={retry}
      disabled={loading}
      className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
    >
      {loading ? '…' : 'Retry'}
    </button>
  );
}
