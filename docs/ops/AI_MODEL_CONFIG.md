# AI model configuration (`/admin/ai-models`)

Which model serves which job used to be a constant in `src/lib/ai/aiTextProvider.ts`.
It is now an admin screen backed by two tables, so changing the model behind full
redesign — or pointing a job at your own GPU — is a form submission rather than a
deploy.

## The rule that makes this safe

**Nothing configured ⇒ nothing changes.** Every job has a built-in chain, and it keeps
running until an admin assigns something to it. Resolution failures (no rows, database
unreachable, provider deleted, key won't decrypt) all fall back to that built-in chain
and log a warning. A bad row cannot take generation down.

## Setup: `AI_CONFIG_KEY`

Provider API keys are stored encrypted (AES-256-GCM, `src/lib/crypto/secretBox.ts`).
Generate the key once:

```bash
openssl rand -base64 32
```

Set it in **both** places, to the **same value**:

- Vercel project env (`AI_CONFIG_KEY`) — used by API routes and pages
- The worker VM's `.env.local` — used by every background job

If only one has it, that half reads your configuration and the other silently falls back
to the built-in chains. The admin screen warns when its own environment is missing it.

Rotating the key makes every stored credential undecryptable; those providers get
skipped (with a log line) until the keys are re-entered.

## Registering a provider

| Field | Notes |
|---|---|
| Slug | Stable id that assignments reference. Renaming a label is safe; changing a slug orphans assignments. |
| Type | The wire protocol, not the brand. Ollama, LM Studio, vLLM and LocalAI are all **OpenAI-compatible**. |
| Base URL | Blank means the vendor default. For OpenAI-compatible runtimes it usually ends in `/v1`. |
| API key | Optional — most local runtimes ignore it. Stored encrypted; the UI only ever shows the last four characters. |

**Local runtimes must be publicly reachable.** Generation runs on Vercel and on the
Oracle VM worker, so `http://localhost:11434/v1` points at *those* hosts, not at your
machine — the screen rejects loopback and RFC1918 addresses for that reason. Expose the
runtime first:

```bash
ollama serve                                  # 127.0.0.1:11434
tailscale serve --https=443 11434             # or cloudflared / ngrok
# then register https://<your-host>.ts.net/v1
```

Use **Test** after saving. It lists the endpoint's models, which catches a down tunnel,
a wrong port, a missing `/v1`, or a model that was never pulled — all of which otherwise
surface hours later as a failed build. Note the test runs from *Vercel*; the worker VM
has separate egress and can still differ.

## Assigning models

Each job (a "purpose", see `src/lib/ai/purposes.ts`) takes an ordered chain. The second
entry is tried when the first fails, exactly like the built-in chains. Anything left
empty shows as *Inherited* and keeps its built-in behavior.

Sensible first move: point `craft_answers` (small, cheap, not customer-facing) at a local
model and watch the logs before touching `full_redesign_page`.

Verify routing in the worker/function logs — `ai_text_call` carries the endpoint slug:

```
{"event":"ai_text_call","provider":"openai","endpoint":"workshop-4090","model":"llama3.1:70b",…}
```

## Images are different

Ollama and LM Studio are **text and vision only** — they cannot generate images. Image
purposes need a runtime exposing OpenAI-compatible `/v1/images/generations` (LocalAI,
some ComfyUI/vLLM gateways) or a Gemini provider. Anthropic is rejected outright for
image purposes at save time.

Image editing (`image_edit`, `image_before_after`) is narrower still: only Gemini
endpoints are wired for configured image-to-image, because the vendors disagree about
the request shape. Assigning a non-Gemini provider there logs a warning and uses the
built-in chain.

## When a change takes effect

Resolution caches for 60 seconds per process, keyed on a config version row that every
write bumps. The process that made the change sees it immediately; other Vercel
instances and the worker pick it up within a minute. No restart or redeploy needed —
that is the entire point.

## Where things live

| Concern | File |
|---|---|
| Purpose registry | `src/lib/ai/purposes.ts` |
| Resolution + cache | `src/lib/ai/modelRouting.ts` |
| Text entry point | `generateTextForPurpose` in `src/lib/ai/aiTextProvider.ts` |
| Image entry points | `src/lib/openai-images.ts` |
| Admin CRUD | `src/lib/ai/aiConfigAdmin.ts` |
| Connectivity test | `src/lib/ai/testProviderEndpoint.ts` |
| Schema | `supabase/migrations/20260815064500_ai_model_config.sql` |

The tables carry a `platform_` prefix because this Supabase project is **shared with
another application** that already owns a `public.ai_providers` table with a completely
different shape (per-user keys, FK to its own `users`). Check `\dt public.*` before
adding a table here — `CREATE TABLE IF NOT EXISTS` will silently skip a name that is
already taken and then apply your constraints to somebody else's data.

Adding a new AI call means adding a purpose to the registry — otherwise it bypasses the
admin screen entirely and always runs the built-in chain.
