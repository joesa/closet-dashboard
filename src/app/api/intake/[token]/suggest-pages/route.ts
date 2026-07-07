import { NextResponse } from 'next/server';
import { generateTextWithFallback } from '@/lib/ai/aiTextProvider';
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken';
import { assertDraftIntake, assertDepositPaid } from '@/lib/intake/intakeTierGates';
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit';

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

export async function POST(
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

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body
    }

    const { industry = '', services = [], otherServices = '', businessName = '', existingPages = [] } = body;

    const systemPrompt = `You are an expert digital marketing strategist for local service businesses and contractors. Your job is to suggest exactly 5 highly-specific, conversion-optimized website pages that this business should add to their site.
    
    Do NOT suggest generic pages like "Home", "About", "Contact", "Services", "Portfolio", "FAQ", "Testimonials", "Process", or "Financing".
    Instead, suggest highly specific service pages based on what the business does. 
    For example: 
    - If it's a Landscaping business, suggest: "Hardscaping & Patios", "Lawn Care & Maintenance", "Snow Removal", "Retaining Walls".
    - If it's a Plumbing business, suggest: "Emergency Plumbing", "Water Heater Repair", "Drain Cleaning", "Pipe Leak Repair".
    
    Return the response as valid JSON in this exact format:
    {
      "suggestions": [
        {
          "slug": "url-friendly-slug-with-dashes",
          "label": "Human Readable Title",
          "description": "A very short 1-sentence description of what this page will cover."
        }
      ]
    }`;

    const userPrompt = `Business Name: ${businessName}
Industry: ${industry}
Primary Services: ${Array.isArray(services) ? services.join(', ') : services}
Other Services: ${otherServices}
Existing/Already Selected Pages: ${Array.isArray(existingPages) ? existingPages.join(', ') : existingPages}

Provide 5 specific service-level page suggestions tailored to this exact business. Do NOT suggest any of the existing/already selected pages.`;

    const { text } = await generateTextWithFallback({
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      jsonMode: true,
      temperature: 0.7,
      maxOutputTokens: 1024,
    });

    const parsed = JSON.parse(sanitizeJsonString(extractJson(text)));
    if (!parsed || !Array.isArray(parsed.suggestions)) {
      throw new Error('AI returned invalid JSON structure');
    }

    const filtered = parsed.suggestions.filter((s: any) => {
      const slug = String(s.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '');
      return slug && slug !== 'home' && slug !== 'about' && slug !== 'contact' && !existingPages.includes(slug);
    }).slice(0, 5);

    return NextResponse.json({ suggestions: filtered });
  } catch (error) {
    console.error('suggest-pages error:', error);
    const message = error instanceof Error ? error.message : 'Failed to suggest pages';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
