import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/admin';
import { provisionTenant } from '@/lib/provision/provisionTenant';
import { ProvisionReviewError } from '@/lib/provision/types';

export async function POST(req: Request) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const mode: 'full' | 'widget' = body.mode === 'widget' ? 'widget' : 'full';
    const loginOrigin = new URL(req.url).origin;

    const result = await provisionTenant({
      businessName: body.businessName,
      theme: body.theme,
      layoutStyle: body.layoutStyle,
      subdomain: body.subdomain,
      ownerEmail: body.ownerEmail,
      heroHeadline: body.heroHeadline,
      aboutDescription: body.aboutDescription,
      heroImage: body.heroImage,
      beforeImage: body.beforeImage,
      services: body.services,
      aiSiteConfig: body.aiSiteConfig,
      aiWidgetConfig: body.aiWidgetConfig,
      intakeSetup: body.intakeSetup,
      intakeId: body.intakeId,
      mode,
      siteStatus: mode === 'widget' ? 'widget_only' : 'active',
      loginOrigin,
      sendWelcomeEmail: true,
    });

    return NextResponse.json({
      success: true,
      mode: result.mode,
      url: result.url,
      domain: result.domain,
      widgetId: result.widgetId,
      embedSnippet: result.embedSnippet,
      ownerEmail: result.ownerEmail,
      loginUrl: result.loginUrl,
      tempPassword: result.tempPassword,
    });
  } catch (error) {
    console.error('Sandbox provision error:', error);
    if (error instanceof ProvisionReviewError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    let message = 'Internal error';
    if (error instanceof Error) {
      message = error.message;
    } else if (error && typeof error === 'object') {
      const e = error as { message?: string; details?: string; code?: string };
      message = [e.message, e.details, e.code && `(${e.code})`].filter(Boolean).join(' ') || 'Internal error';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
