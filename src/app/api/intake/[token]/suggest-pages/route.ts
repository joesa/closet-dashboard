import { NextResponse } from 'next/server';
import { generateTextForPurpose } from '@/lib/ai/aiTextProvider';
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken';
import { assertDraftIntake, assertDepositPaid } from '@/lib/intake/intakeTierGates';
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit';
import { buildIntakeBrief } from '@/lib/intake/buildIntakeBrief';
import { SITE_PAGE_OPTIONS } from '@/lib/catalog/sitePages';
import { enqueueIntakeGeneration, isOracleExecution } from '@/lib/jobs/intakeGeneration';
import { includesServiceOffering, splitServiceOfferings } from '@/lib/intake/serviceOffering';

export const maxDuration = 30;
export const runtime = 'nodejs';

function sanitizeJsonString(json: string): string {
  let insideString = false;
  let escaped = false;
  let result = '';
  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (char === '"' && !escaped) {
      insideString = !insideString;
      result += char;
    } else if (char === '\\' && insideString && !escaped) {
      escaped = true;
      result += char;
    } else {
      if (insideString) {
        if (char === '\n') result += '\\n';
        else if (char === '\r') result += '\\r';
        else if (char === '\t') result += '\\t';
        else if (char.charCodeAt(0) < 32) result += '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
        else result += char;
      } else {
        result += char;
      }
      escaped = false;
    }
  }
  return result;
}

function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const firstObj = t.indexOf('{');
  const lastObj = t.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) return t.slice(firstObj, lastObj + 1);
  return t;
}

type RawSuggestion = { slug?: unknown; label?: unknown; description?: unknown };

/**
 * Parse the model's suggestions, tolerating malformed/truncated JSON. LLMs
 * occasionally return an unterminated string or cut off mid-array (especially
 * near the token limit), which made a strict JSON.parse throw a 500 on what is
 * a best-effort, silently-auto-fetched enhancement. First try a normal parse;
 * on failure, salvage every COMPLETE `{...}` object that carries a "slug" (a
 * truncated trailing object simply won't match and is dropped).
 */
function parseSuggestions(text: string): RawSuggestion[] {
  const json = sanitizeJsonString(extractJson(text));
  try {
    const parsed = JSON.parse(json) as { suggestions?: unknown };
    if (parsed && Array.isArray(parsed.suggestions)) {
      return parsed.suggestions as RawSuggestion[];
    }
  } catch {
    /* fall through to salvage */
  }
  const salvaged: RawSuggestion[] = [];
  // Suggestion objects are flat (no nested braces), so a non-greedy object
  // match is sufficient to recover the complete ones.
  const objects = json.match(/\{[^{}]*?"slug"[^{}]*?\}/g) || [];
  for (const obj of objects) {
    try {
      salvaged.push(JSON.parse(obj) as RawSuggestion);
    } catch {
      /* skip an unrecoverable fragment */
    }
  }
  return salvaged;
}

async function executeIntakeSuggestPages(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'API keys are not configured.' }, { status: 500 });
    }

    const { token } = await params;
    const row = await getIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 });
    }

    const draftErr = assertDraftIntake(row);
    if (draftErr) {
      return NextResponse.json({ error: draftErr }, { status: 410 });
    }

    const depositErr = assertDepositPaid(row);
    if (depositErr) {
      return NextResponse.json({ error: depositErr }, { status: 403 });
    }

    const limit = await checkRateLimit(hashRateKey('intake_suggest_pages', token), 20, 24 * 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many suggestions today. Try again tomorrow.' }, { status: 429 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Empty body
    }

    const { existingPages = [] } = body;

    // Merge any fresh, not-yet-saved form values from the request onto the
    // persisted intake so suggestions reflect the prospect's LATEST context —
    // industry, every service, differentiators, ideal customers, tone/vibe,
    // pricing, service area, experience, etc. (no DB write; in-memory only).
    const toStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const toArr = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;
    const merged = { ...row };
    const apply = <K extends keyof typeof merged>(key: K, value: (typeof merged)[K] | undefined) => {
      if (value !== undefined) merged[key] = value;
    };
    apply('business_name', toStr(body.businessName));
    apply('industry', toStr(body.industry));
    apply('service_area', toStr(body.serviceArea));
    apply('vibe', toStr(body.vibe));
    apply('tone', toStr(body.tone));
    apply('customers', toStr(body.customers));
    apply('experience', toStr(body.experience));
    apply('primary_cta', toStr(body.primaryCta));
    apply('pricing_notes', toStr(body.pricingNotes));
    apply('notes', toStr(body.notes));
    apply('services', toArr(body.services));
    apply('other_services', toStr(body.otherServices));
    apply('differentiators', toArr(body.differentiators));

    const brief = buildIntakeBrief(merged);

    // Standard catalog pages the picker already offers — the AI must not
    // duplicate these; it should propose *additional* trade-specific pages.
    const standardLabels = SITE_PAGE_OPTIONS.map((p) => p.label).join(', ');
    const existing = Array.isArray(existingPages) ? existingPages : [];

    const systemPrompt = `You are an expert service-catalog strategist for local businesses and contractors. Suggest exactly 5 highly-specific OFFERINGS that could be added beneath the existing Services page, derived DIRECTLY from the full business brief.

    Rules:
    - These are service sub-items, NEVER standalone pages or city/location pages.
    - Do not repeat, rename, or lightly rephrase an offering already listed in the brief.
    - Suggest only a plausible adjacent offering supported by the business's stated trade and capabilities. Do not invent unsupported specialties.
    - Do NOT suggest generic pages available in the builder: ${standardLabels} (nor Home).
    - Match the brand's tone/vibe from the brief in each label and description.

    Examples of the specificity expected:
    - Landscaping (offers patios, lawn care, snow): "Hardscaping & Patios", "Lawn Care & Maintenance", "Seasonal Snow Removal".
    - Plumbing (offers emergency work, water heaters): "24/7 Emergency Plumbing", "Water Heater Installation & Repair", "Drain Cleaning".

    Return the response as valid JSON in this exact format:
    {
      "suggestions": [
        {
          "slug": "stable-offering-identifier-with-dashes",
          "label": "Human Readable Title",
          "description": "A very short sentence describing this service offering."
        }
      ]
    }`;

    const userPrompt = `Business Brief:
${brief}

Already-selected pages (do NOT suggest these): ${existing.length ? existing.join(', ') : '(none yet)'}

Provide exactly 5 service offerings tailored to THIS business. They will appear as sub-items beneath Services, not as pages.`;

    const { text } = await generateTextForPurpose('intake_suggest_pages', {
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      jsonMode: true,
      temperature: 0.7,
      // Roomier budget so 5 full suggestions don't get truncated mid-JSON.
      maxOutputTokens: 2048,
    });

    const suggestions = parseSuggestions(text);

    const existingOfferings = [
      ...(Array.isArray(merged.services) ? merged.services : []),
      ...splitServiceOfferings(merged.other_services),
    ];
    const seenOfferingKeys = new Set<string>();
    const filtered = suggestions
      .filter((s) => {
        const slug = String(s.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '');
        const label = String(s.label || '');
        const duplicateInBatch = includesServiceOffering([...seenOfferingKeys], label);
        if (!duplicateInBatch) {
          // Store normalized values by feeding the same matcher values it can
          // compare on subsequent iterations.
          seenOfferingKeys.add(label);
        }
        return (
          slug &&
          slug !== 'home' &&
          slug !== 'about' &&
          slug !== 'contact' &&
          !existing.includes(slug) &&
          !includesServiceOffering(existingOfferings, label) &&
          !duplicateInBatch
        );
      })
      .slice(0, 5);

    // Best-effort feature: return whatever we could salvage (possibly empty)
    // with a 200 so the intake UI just shows no AI suggestions instead of
    // surfacing a 500 for a malformed model response.
    return NextResponse.json({ suggestions: filtered });
  } catch (error) {
    // Reaching here means a real failure (network/config/etc.), not just a
    // malformed model response (which parseSuggestions handles gracefully).
    console.error('suggest-pages error:', error);
    const message = error instanceof Error ? error.message : 'Failed to suggest pages';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (isOracleExecution(req)) {
    return executeIntakeSuggestPages(req, { params: Promise.resolve({ token }) });
  }
  return enqueueIntakeGeneration(req, token, 'suggest-pages');
}
