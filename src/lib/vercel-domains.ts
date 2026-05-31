// Helpers for attaching a prospect's custom domain to the multi-tenant websites
// Vercel project during provisioning. Attaching a domain tells Vercel to route
// requests for that hostname to the project and to issue an SSL certificate
// once DNS is verified. All calls are best-effort: provisioning never fails
// because of a domain issue, it just reports the status back to the operator.

export type VercelDomainResult = {
  // Whether we actually called the Vercel API (false when env vars are missing).
  attempted: boolean;
  ok: boolean;
  status?: number;
  // Vercel returns verified=false + verification records when DNS isn't set up yet.
  verified?: boolean;
  verification?: unknown;
  note?: string;
  error?: string;
};

/**
 * Normalize a user-entered domain into a bare hostname suitable for the
 * `domains` table and the Vercel API. Strips protocol, path, port, and a
 * leading `www.`; lowercases; and validates it looks like a real domain
 * (at least one dot, valid label chars). Returns null for blank/invalid input.
 */
export function normalizeDomain(input?: string | null): string | null {
  if (!input) return null;
  let host = input.trim().toLowerCase();
  if (!host) return null;
  host = host.replace(/^https?:\/\//, ''); // strip protocol
  host = host.replace(/\/.*$/, ''); // strip path
  host = host.replace(/:\d+$/, ''); // strip port
  host = host.replace(/^www\./, ''); // strip leading www
  // Each label: starts/ends alphanumeric, may contain hyphens; require a TLD.
  const valid = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host);
  return valid ? host : null;
}

/**
 * Attach `hostname` to the websites Vercel project. No-op (attempted=false) when
 * VERCEL_API_TOKEN or VERCEL_WEBSITES_PROJECT_ID aren't configured. A domain
 * that is already attached to this project is treated as success.
 */
export async function attachVercelDomain(hostname: string): Promise<VercelDomainResult> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_WEBSITES_PROJECT_ID;
  if (!token || !projectId) {
    return {
      attempted: false,
      ok: false,
      error: 'VERCEL_API_TOKEN or VERCEL_WEBSITES_PROJECT_ID not set',
    };
  }

  const teamId = process.env.VERCEL_TEAM_ID;
  const url = new URL(`https://api.vercel.com/v10/projects/${projectId}/domains`);
  if (teamId) url.searchParams.set('teamId', teamId);

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: hostname }),
    });

    const data: unknown = await res.json().catch(() => ({}));

    if (!res.ok) {
      const code = (data as { error?: { code?: string } })?.error?.code;
      // Domain already on this project — idempotent success.
      if (res.status === 409 || code === 'domain_already_in_use') {
        return { attempted: true, ok: true, status: res.status, note: 'already_attached' };
      }
      const message =
        (data as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`;
      return { attempted: true, ok: false, status: res.status, error: message };
    }

    return {
      attempted: true,
      ok: true,
      status: res.status,
      verified: (data as { verified?: boolean }).verified,
      verification: (data as { verification?: unknown }).verification,
    };
  } catch (e) {
    return {
      attempted: true,
      ok: false,
      error: e instanceof Error ? e.message : 'request failed',
    };
  }
}
