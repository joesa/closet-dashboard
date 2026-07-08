'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Message = {
  role: 'admin' | 'assistant';
  content: string;
  /** Attached images as data URLs (screenshots / reference designs). */
  images?: string[];
  /** site_configs columns the assistant changed with this reply. */
  applied?: string[];
  rejected?: Array<{ column: string; reason: string }>;
};

const MAX_ATTACHMENTS = 4;

/**
 * Downscale an image file to a chat-friendly data URL. Screenshots are often
 * 4-8MB PNGs; resizing to ≤1600px JPEG keeps the request small without losing
 * the detail the model needs to read a layout problem.
 */
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

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
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[]) => {
    setError('');
    try {
      const imageFiles = [...files].filter((f) => f.type.startsWith('image/'));
      const room = MAX_ATTACHMENTS - attachments.length;
      if (imageFiles.length > room) {
        setError(`Up to ${MAX_ATTACHMENTS} images per message.`);
      }
      const dataUrls = await Promise.all(imageFiles.slice(0, room).map(fileToDataUrl));
      if (dataUrls.length) setAttachments((prev) => [...prev, ...dataUrls]);
    } catch {
      setError('Could not read that image — try a PNG or JPEG.');
    }
  };

  const send = async () => {
    const content = input.trim();
    if ((!content && attachments.length === 0) || loading) return;
    setError('');
    setInput('');
    const images = attachments;
    setAttachments([]);
    const nextMessages: Message[] = [
      ...messages,
      {
        role: 'admin',
        content: content || '(see attached image)',
        images: images.length ? images : undefined,
      },
    ];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sites/${tenantId}/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
            images: m.images,
          })),
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
        and the AI will apply it to this site. Attach or paste screenshots to show a visual
        problem or a reference design. Ask questions about the current config too.
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
                {m.images && m.images.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {m.images.map((src, j) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={j}
                        src={src}
                        alt={`Attachment ${j + 1}`}
                        className="h-24 max-w-40 rounded border border-neutral-700 object-cover"
                      />
                    ))}
                  </div>
                )}
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

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Attachment ${i + 1}`}
                className="h-16 w-24 rounded border border-neutral-700 object-cover"
              />
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800 border border-neutral-600 text-xs text-neutral-300 hover:bg-red-500/80 hover:text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          aria-label="Attach image"
          title="Attach a screenshot or reference image"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || attachments.length >= MAX_ATTACHMENTS}
          className="self-end rounded-lg border border-neutral-700 bg-black/50 px-3 py-3 text-sm text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white disabled:opacity-50"
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          onPaste={(e) => {
            const files = [...e.clipboardData.items]
              .filter((item) => item.type.startsWith('image/'))
              .map((item) => item.getAsFile())
              .filter((f): f is File => !!f);
            if (files.length) {
              e.preventDefault();
              void addFiles(files);
            }
          }}
          rows={2}
          placeholder='e.g. "Shorten the hero headline", "Add an FAQ page about pricing", or attach/paste a screenshot of the problem'
          className="flex-1 resize-none rounded-lg border border-neutral-700 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || (!input.trim() && attachments.length === 0)}
          className="self-end rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send'}
        </button>
      </div>
    </section>
  );
}
