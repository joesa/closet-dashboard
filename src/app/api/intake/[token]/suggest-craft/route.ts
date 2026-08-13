import { NextResponse } from 'next/server';
import { suggestCraftAnswers } from '@/lib/ai/suggestCraftAnswers';
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit';
import { enqueueIntakeGeneration, isOracleExecution } from '@/lib/jobs/intakeGeneration';

export const maxDuration = 30;
export const runtime = 'nodejs';

/**
 * AI-tailored "Craft & Proof" answer suggestions for step 4 of the intake form,
 * based on the prospect's industry, business name, services, and location.
 */
async function executeIntakeSuggestCraft(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const rate = await checkRateLimit(hashRateKey('suggest-craft', token), 15, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      { status: 429 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }

  const toStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const toArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  const result = await suggestCraftAnswers({
    industry: toStr(body.industry),
    businessName: toStr(body.businessName),
    services: toArr(body.services),
    otherServices: toStr(body.otherServices),
    serviceArea: toStr(body.serviceArea),
    vibe: toStr(body.vibe),
    tone: toStr(body.tone),
    differentiators: toArr(body.differentiators),
    singleField: toStr(body.singleField),
  });

  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (isOracleExecution(req)) {
    return executeIntakeSuggestCraft(req, { params: Promise.resolve({ token }) });
  }
  return enqueueIntakeGeneration(req, token, 'suggest-craft');
}
