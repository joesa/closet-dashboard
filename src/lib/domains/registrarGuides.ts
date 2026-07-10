import type { DnsInstruction } from '@/lib/domains/types'

export type RegistrarGuideId =
  | 'godaddy'
  | 'namecheap'
  | 'cloudflare'
  | 'hostinger'
  | 'google'
  | 'other'

export type RegistrarGuide = {
  id: RegistrarGuideId
  name: string
  /** Short steps shown in the UI (DNS A/CNAME path). */
  steps: string[]
  helpUrl?: string
}

/**
 * Popular-registrar DNS guides for BYO domains.
 * We do not integrate registrar APIs — customers paste the same A/CNAME
 * (or NS) records into whichever panel they already use.
 */
export const REGISTRAR_DNS_GUIDES: RegistrarGuide[] = [
  {
    id: 'godaddy',
    name: 'GoDaddy',
    helpUrl: 'https://www.godaddy.com/help/manage-dns-records-680',
    steps: [
      'Sign in at GoDaddy → My Products → Domains → select your domain → DNS / Manage DNS.',
      'Delete or edit any existing A record for @ (and any conflicting www CNAME) that points elsewhere.',
      'Add an A record: Name/Host = @, Value/Points to = 76.76.21.21, TTL = 1 Hour (or default).',
      'Add a CNAME: Name/Host = www, Value = cname.vercel-dns.com.',
      'Save. Wait 5–60 minutes, then click Check DNS in your dashboard.',
    ],
  },
  {
    id: 'namecheap',
    name: 'Namecheap',
    helpUrl: 'https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-an-a-address-record-for-my-domain/',
    steps: [
      'Sign in → Domain List → Manage → Advanced DNS.',
      'Under Host Records, remove conflicting A / CNAME / URL Redirect records for @ and www.',
      'Add A Record: Host = @, Value = 76.76.21.21, TTL = Automatic.',
      'Add CNAME Record: Host = www, Value = cname.vercel-dns.com.',
      'Save all changes, then Check DNS in your dashboard after a few minutes.',
    ],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    helpUrl: 'https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/',
    steps: [
      'Open the domain in Cloudflare → DNS → Records.',
      'Add A: Name = @ (or your root), IPv4 = 76.76.21.21. Set Proxy status to DNS only (grey cloud) until verified.',
      'Add CNAME: Name = www, Target = cname.vercel-dns.com (DNS only).',
      'Remove old A/AAAA/CNAME records that conflict.',
      'Save, then Check DNS. You can turn the orange cloud back on after the site is verified if you want Cloudflare proxy.',
    ],
  },
  {
    id: 'hostinger',
    name: 'Hostinger',
    helpUrl: 'https://support.hostinger.com/en/articles/1583463-how-to-manage-dns-records-at-hostinger',
    steps: [
      'hPanel → Domains → Manage → DNS / Name Servers → DNS records.',
      'Remove conflicting A / CNAME records for @ and www.',
      'Add A: Name = @, Points to = 76.76.21.21.',
      'Add CNAME: Name = www, Points to = cname.vercel-dns.com.',
      'Save and Check DNS from your dashboard after propagation.',
    ],
  },
  {
    id: 'google',
    name: 'Google Domains / Squarespace',
    helpUrl: 'https://support.squarespace.com/hc/en-us/articles/205812378',
    steps: [
      'Open the domain in Google Domains or Squarespace Domains → DNS settings.',
      'Use Custom records (not website forwarding) for the apex and www.',
      'Add A: Host = @ / blank, Data = 76.76.21.21.',
      'Add CNAME: Host = www, Data = cname.vercel-dns.com.',
      'Save, wait for propagation, then Check DNS.',
    ],
  },
  {
    id: 'other',
    name: 'Other registrar',
    steps: [
      'Find DNS / DNS Management / Zone Editor for your domain (not “forwarding” or “parking”).',
      'Create an A record for the root (@ or blank) pointing to 76.76.21.21.',
      'Create a CNAME for www pointing to cname.vercel-dns.com.',
      'Remove old A/AAAA/CNAME/URL-redirect records that conflict.',
      'Wait for DNS to update (often under an hour), then Check DNS in your dashboard.',
    ],
  },
]

export function formatDnsRecordsForCopy(instructions: DnsInstruction[]): string {
  return instructions
    .map((ins) => `${ins.type}\t${ins.name}\t${ins.value}`)
    .join('\n')
}
