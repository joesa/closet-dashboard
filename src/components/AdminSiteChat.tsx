'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Message = {
  role: 'admin' | 'assistant';
  content: string;
  /** site_configs columns the assistant changed with this reply. */
  applied?: string[];
  rejected?: Array<{ column: string; reason: string }>;
};

/**
 * Conversational site editor for the admin tenant detail page. The admin
 * describes changes in plain English ("shorten the hero headline", "add an
 * FAQ page about pricing", "switch the theme to brutalist") and the AI
 * applies them directly to this tenant's live site config.
 */
export default function AdminSiteChat({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const content = input.trim();
    if (!content || loading) return;
    setError('');
    setInput('');
    const nextMessages: Message[] = [...messages, { role: 'admin', content }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sites/${tenantId}/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Chat failed');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: json.reply || 'Done.',
          applied: json.applied || [],
          rejected: json.rejected || [],
        },
      ]);
      if (Array.isArray(json.applied) && json.applied.length > 0) {
        // Config sections on this page are server-rendered — refresh them so
        // the admin immediately sees the new copy/theme/products.
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
      // Keep the admin's message in the thread so they can retry with context.
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  };

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
          AI Site Assistant
        </h3>
        <span className="text-xs text-neutral-500">
          Changes apply to the live site config immediately
        </span>
      </div>
      <p className="text-sm text-neutral-400">
        Describe a change in plain English — copy, services, pages, nav, theme, process steps —
        and the AI will apply it to this site. Ask questions about the current config too.
      </p>

      {messages.length > 0 && (
        <div
          ref={scrollRef}
          className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-neutral-800 bg-black/30 p-4"
        >
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'admin' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2 text-sm text-left ${
                  m.role === 'admin'
                    ? 'bg-blue-600/20 text-blue-100 border border-blue-500/20'
                    : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                }`}
              >
                {m.content}
                {m.applied && m.applied.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.applied.map((col) => (
                      <span
                        key={col}
                        className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-mono text-emerald-400"
                      >
                        ✓ {col}
                      </span>
                    ))}
                  </div>
                )}
                {m.rejected && m.rejected.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {m.rejected.map((r, j) => (
                      <div key={j} className="text-xs text-amber-400">
                        Skipped {r.column}: {r.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-left">
              <div className="inline-block rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-400">
                Thinking…
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder='e.g. "Shorten the hero headline", "Add an FAQ page about pricing", "Rename the House Washing service to Exterior House Washing"'
          className="flex-1 resize-none rounded-lg border border-neutral-700 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          className="self-end rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send'}
        </button>
      </div>
    </section>
  );
}
