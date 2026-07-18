'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type ValidationIssueShape = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  fixable: boolean;
};

type Props = {
  tenantId: string;
  status: 'pending' | 'passed' | 'failed' | null;
  issues: ValidationIssueShape[];
  validatedAt: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  passed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function SiteValidationPanel({ tenantId, status, issues, validatedAt }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<'validate' | 'fix' | null>(null);
  const [error, setError] = useState('');
  const [aiNote, setAiNote] = useState<string | null>(null);

  const call = async (kind: 'validate' | 'fix') => {
    setLoading(kind);
    setError('');
    setAiNote(null);
    try {
      const res = await fetch(`/api/admin/sites/${tenantId}/${kind === 'validate' ? 'validate' : 'ai-fix'}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      if (kind === 'fix' && typeof json.aiNote === 'string') setAiNote(json.aiNote);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(null);
    }
  };

  const errorIssues = issues.filter((i) => i.severity === 'error');
  const warningIssues = issues.filter((i) => i.severity === 'warning');
  const hasFixable = issues.some((i) => i.fixable);

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Site Validation</h3>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
            status ? STATUS_STYLES[status] : 'bg-neutral-800 text-neutral-400 border-neutral-700'
          }`}
        >
          {status === 'passed' && 'All checks passed'}
          {status === 'failed' && `${errorIssues.length} issue${errorIssues.length === 1 ? '' : 's'} found`}
          {status === 'pending' && 'Validation pending'}
          {!status && 'Not yet validated'}
        </span>
      </div>

      {status !== 'passed' && (
        <p className="text-sm text-neutral-400">
          This site is <strong>not yet ready for preview and approval</strong> until validation passes.
          {status === 'failed' && ' Review the issues below, then use AI to fix what it can, or fix manually and re-validate.'}
        </p>
      )}

      {validatedAt && (
        <p className="text-xs text-neutral-500" suppressHydrationWarning>
          Last checked:{' '}
          {new Date(validatedAt).toLocaleString('en-US', {
            timeZone: 'UTC',
            dateStyle: 'medium',
            timeStyle: 'short',
          })}{' '}
          UTC
        </p>
      )}

      {issues.length > 0 && (
        <ul className="space-y-2">
          {[...errorIssues, ...warningIssues].map((issue, i) => (
            <li
              key={`${issue.code}-${i}`}
              className={`text-sm rounded-lg border px-4 py-3 ${
                issue.severity === 'error'
                  ? 'border-red-500/20 bg-red-500/5 text-red-300'
                  : 'border-amber-500/20 bg-amber-500/5 text-amber-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span>{issue.message}</span>
                {issue.fixable && (
                  <span className="shrink-0 text-xs font-medium text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                    AI-fixable
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {aiNote && (
        <div className="text-sm rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-200 px-4 py-3">
          <strong className="block text-xs uppercase tracking-widest text-blue-400 mb-1">AI Summary</strong>
          {aiNote}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => call('validate')}
          disabled={loading !== null}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading === 'validate' ? 'Validating…' : status ? 'Re-validate' : 'Run Validation'}
        </button>
        {status === 'failed' && hasFixable && (
          <button
            type="button"
            onClick={() => call('fix')}
            disabled={loading !== null}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading === 'fix' ? 'Fixing…' : '✨ Fix with AI'}
          </button>
        )}
      </div>
    </section>
  );
}
