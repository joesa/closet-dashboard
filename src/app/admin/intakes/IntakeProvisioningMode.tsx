'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'auto' | 'manual';

export default function IntakeProvisioningMode({
  intakeId,
  initialMode,
  status,
}: {
  intakeId: string;
  initialMode: Mode;
  status: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loading, setLoading] = useState(false);

  const canEdit = status === 'draft' || status === 'submitted';

  const update = async (next: Mode) => {
    if (!canEdit || next === mode) return;
    setLoading(true);
    try {
      const res = await fetch('/api/intake/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: intakeId, provisioningMode: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      setMode(next);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        value={mode}
        disabled={!canEdit || loading}
        onChange={(e) => update(e.target.value as Mode)}
        className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
        title={mode === 'manual' ? 'No auto template build after submit' : 'Template build queued on submit'}
      >
        <option value="auto">Auto template</option>
        <option value="manual">Manual AI</option>
      </select>
      {mode === 'manual' && status === 'submitted' && (
        <span className="text-[10px] text-amber-700">Use Build site →</span>
      )}
    </div>
  );
}
