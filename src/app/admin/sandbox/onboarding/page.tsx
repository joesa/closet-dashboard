'use client';

import React, { useEffect, useState } from 'react';
import GuidedBuilder, { type GuidedResult } from './GuidedBuilder';

// Sandbox/testing helper: fabricate a fake but usable login email. We only ever
// surface these on non-production hosts so the production onboarding page never
// shows a throwaway address. Convention: someName####@example.com.
const TEST_NAMES = ['joe', 'yaw', 'sam', 'ada', 'kofi', 'lena', 'max', 'nia'];
function generateTestEmail() {
  const name = TEST_NAMES[Math.floor(Math.random() * TEST_NAMES.length)];
  return `${name}${Math.floor(Math.random() * 10000)}@example.com`;
}

type AiSiteConfig = {
  theme?: string;
  hero?: { headline?: string };
  about?: { description?: string };
  pagesConfig?: unknown[];
  [key: string]: unknown;
};

type AiWidgetConfig = {
  customRooms?: { name?: string }[];
  customAddOns?: { name?: string }[];
  customFinishes?: unknown[];
  [key: string]: unknown;
};

export default function SandboxOnboarding() {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginUrl, setLoginUrl] = useState('');
  const [embedSnippet, setEmbedSnippet] = useState('');
  const [resultMode, setResultMode] = useState<'full' | 'widget'>('full');
  // 'full' = Pipeline B (website + calculator). 'widget' = Pipeline A (calculator
  // widget only, for an existing site — this is where we upsell the full build).
  const [siteMode, setSiteMode] = useState<'full' | 'widget'>('full');
  const [showGuide, setShowGuide] = useState(false);

  // Guided builder finished: turn the answers into an AI brief and pre-fill the
  // theme/services the operator can still tweak before generating.
  const handleGuideComplete = (result: GuidedResult) => {
    setAiInput(result.description);
    setFormData((prev) => ({
      ...prev,
      theme: result.theme || prev.theme,
      services: result.services && result.services.length > 0 ? result.services : prev.services,
    }));
    setShowGuide(false);
  };
  const [error, setError] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [sitemap, setSitemap] = useState<string[]>([]);
  const [isSitemapGenerated, setIsSitemapGenerated] = useState(false);
  const [aiUpsellPitch, setAiUpsellPitch] = useState('');
  const [aiWidgetConfig, setAiWidgetConfig] = useState<AiWidgetConfig | null>(null);
  const [aiSiteConfig, setAiSiteConfig] = useState<AiSiteConfig | null>(null);

  // True only on localhost / non-production hosts. Used to expose test-only
  // helpers (fake login emails) that must never appear on production.
  const [isSandbox, setIsSandbox] = useState(false);

  const [formData, setFormData] = useState(() => ({
    businessName: 'Apex Garage Builds',
    theme: 'brutalist',
    layoutStyle: 'standard',
    subdomain: 'apex',
    ownerEmail: '',
    heroHeadline: 'Built For Garages That Dominate',
    aboutDescription: 'Apex Garage Builds engineers brutalist, high-performance garage environments for those who demand absolute durability.',
    heroImage: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
    beforeImage: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
    services: ['Walk-In Closets', 'Garages', 'Home Offices'] // Default selection
  }));

  // Detect sandbox/testing context on the client (avoids SSR hydration
  // mismatch). On non-production hosts, pre-fill a fake @example.com login so
  // testers have a working username without using a real inbox.
  useEffect(() => {
    const host = window.location.hostname;
    const sandbox = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app');
    setIsSandbox(sandbox);
    if (sandbox) {
      setFormData((prev) => (prev.ownerEmail ? prev : { ...prev, ownerEmail: generateTestEmail() }));
    }

    // Deep-link the mode from the originating pipeline:
    // Pipeline A (has a site, needs the widget) => widget-only.
    // Pipeline B (no site) => full build. Also accept ?mode=widget|full.
    const params = new URLSearchParams(window.location.search);
    const pipeline = params.get('pipeline')?.toUpperCase();
    const modeParam = params.get('mode')?.toLowerCase();
    if (modeParam === 'widget' || modeParam === 'full') {
      setSiteMode(modeParam);
    } else if (pipeline === 'A') {
      setSiteMode('widget');
    } else if (pipeline === 'B') {
      setSiteMode('full');
    }
  }, []);

  const availableServices = [
    'Walk-In Closets',
    'Reach-In Closets',
    'Garages',
    'Pantries & Wine',
    'Home Offices',
    'Mudrooms',
    'Wall Beds',
    'Entertainment Centers'
  ];

  const handleServiceToggle = (service: string) => {
    setFormData(prev => {
      const isSelected = prev.services.includes(service);
      return {
        ...prev,
        services: isSelected 
          ? prev.services.filter(s => s !== service)
          : [...prev.services, service]
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResultUrl('');
    setEmbedSnippet('');

    try {
      const res = await fetch('/api/sandbox/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          mode: siteMode,
          // Widget-only builds don't use the AI site content, only widget config.
          aiSiteConfig: siteMode === 'widget' ? null : aiSiteConfig,
          aiWidgetConfig
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to provision');
      
      setResultUrl(data.url || '');
      setTempPassword(data.tempPassword || '');
      setLoginEmail(data.ownerEmail || formData.ownerEmail);
      setLoginUrl(data.loginUrl || '');
      setEmbedSnippet(data.embedSnippet || '');
      setResultMode(data.mode === 'widget' ? 'widget' : 'full');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to provision');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSitemap = async () => {
    if (!aiInput.trim()) {
      setError('Please enter a URL or business description.');
      return;
    }
    
    if (pageCount === 1 || siteMode === 'widget') {
      // Single-page sites (and all widget-only builds) skip sitemap generation.
      setSitemap(['Home']);
      setIsSitemapGenerated(true);
      return;
    }

    setAiLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/generate-sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: aiInput, pageCount })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sitemap Generation failed');
      
      setSitemap(json.data.pages);
      setIsSitemapGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sitemap Generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIGenerate = async () => {
    setAiLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/generate-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: aiInput, sitemap })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'AI Generation failed');
      
      const { siteConfig, widgetConfig, upsellPitch, pagesConfig } = json.data;
      
      if (pagesConfig) {
        siteConfig.pagesConfig = pagesConfig;
      }

      setAiSiteConfig(siteConfig);
      setAiWidgetConfig(widgetConfig);
      setAiUpsellPitch(upsellPitch);
      
      // Pre-fill form data with AI suggestions where applicable
      setFormData(prev => ({
        ...prev,
        theme: siteConfig.theme || prev.theme,
        heroHeadline: siteConfig.hero?.headline || prev.heroHeadline,
        aboutDescription: siteConfig.about?.description || prev.aboutDescription,
        services: [] 
      }));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI Generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-6 py-12">
      {showGuide && (
        <GuidedBuilder onComplete={handleGuideComplete} onClose={() => setShowGuide(false)} />
      )}
      <div className="max-w-3xl w-full">
        <div className="bg-neutral-800 p-8 rounded-xl shadow-2xl border border-neutral-700 mb-8">
          <h1 className="text-2xl font-bold mb-2">Onboarding Simulator</h1>
          <p className="text-neutral-400 mb-6 text-sm">Simulate a new contractor signing up. Generate custom sites using AI.</p>

          {/* Build mode: full website (Pipeline B) vs widget-only (Pipeline A) */}
          <div className="mb-8">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSiteMode('full')}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  siteMode === 'full'
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
                }`}
              >
                <div className="font-bold text-sm">Full Website + Calculator</div>
                <div className="text-xs text-neutral-400 mt-1">Pipeline B — prospect has no site. Build a hosted site with the embedded quote calculator.</div>
              </button>
              <button
                type="button"
                onClick={() => setSiteMode('widget')}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  siteMode === 'widget'
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
                }`}
              >
                <div className="font-bold text-sm">Quote Calculator Widget Only</div>
                <div className="text-xs text-neutral-400 mt-1">Pipeline A — prospect already has a site. Generate the embeddable widget (and upsell the full build).</div>
              </button>
            </div>
          </div>

          {/* AI Generation Section */}
          <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-bold text-indigo-300 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              AI Smart Configuration
            </h2>
            <p className="text-sm text-indigo-200/70 mb-4">
              {siteMode === 'widget'
                ? 'Paste their website URL or a description of their services. The AI will generate a tailored Quote Calculator (custom rooms, add-ons, and finishes) to embed on their existing site.'
                : 'A full build is for prospects with no website yet. Describe the business and what you want on the site — or use the guided builder to answer a few quick questions and we\u2019ll write the brief for you.'}
            </p>
            <div className="flex flex-col gap-4">
              {siteMode === 'full' ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-indigo-200">Describe the business &amp; what to build</label>
                    <button
                      type="button"
                      onClick={() => setShowGuide(true)}
                      disabled={aiLoading || isSitemapGenerated}
                      className="shrink-0 text-xs font-bold bg-neutral-800 hover:bg-neutral-700 border border-indigo-500/40 text-indigo-200 px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                    >
                      Not sure? Use the guided builder
                    </button>
                  </div>
                  <textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="e.g. Family-owned custom closet company serving Nashville. Services: walk-in closets, garages, pantries. Luxury, modern feel. 15 years in business, lifetime warranty, free in-home consultation. Goal: book consultations."
                    rows={4}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-3 text-white"
                    disabled={aiLoading || isSitemapGenerated}
                  />
                </>
              ) : (
                <input 
                  type="text" 
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="https://their-existing-site.com OR 'We are a local builder...'"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-3 text-white"
                  disabled={aiLoading || isSitemapGenerated}
                />
              )}
              <div className="flex gap-4">
                {siteMode === 'full' && (
                <select
                  value={pageCount}
                  onChange={(e) => setPageCount(Number(e.target.value))}
                  className="bg-neutral-900 border border-neutral-700 rounded-md p-3 text-white"
                  disabled={aiLoading || isSitemapGenerated}
                >
                  <option value={1}>1 Page</option>
                  <option value={2}>2 Pages</option>
                  <option value={3}>3 Pages</option>
                  <option value={4}>4 Pages</option>
                  <option value={5}>5 Pages</option>
                </select>
                )}
                {!isSitemapGenerated && (
                  <button 
                    type="button"
                    onClick={handleGenerateSitemap}
                    disabled={aiLoading || !aiInput}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-md font-bold transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? 'Thinking...' : 'Next'}
                  </button>
                )}
              </div>

              {isSitemapGenerated && !aiWidgetConfig && (
                <div className="mt-4 p-4 bg-indigo-950/50 border border-indigo-500/30 rounded-lg">
                  <h3 className="text-sm font-bold text-indigo-300 mb-3">Proposed Sitemap</h3>
                  {pageCount === 1 ? (
                    <p className="text-xs text-indigo-200/70 mb-4">Single landing page architecture selected.</p>
                  ) : (
                    <div className="flex flex-col gap-2 mb-4">
                      {sitemap.map((page, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-neutral-400 w-6">{i + 1}.</span>
                          <input 
                            type="text"
                            value={page}
                            disabled={i === 0} // Home is fixed
                            onChange={(e) => {
                              const newSitemap = [...sitemap];
                              newSitemap[i] = e.target.value;
                              setSitemap(newSitemap);
                            }}
                            className="bg-neutral-900 border border-neutral-700 rounded p-2 text-sm text-white flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsSitemapGenerated(false)}
                      className="bg-transparent border border-neutral-600 hover:border-neutral-500 text-white px-4 py-2 rounded-md font-bold transition-colors"
                    >
                      Back
                    </button>
                    <button 
                      type="button"
                      onClick={handleAIGenerate}
                      disabled={aiLoading}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-md font-bold transition-colors disabled:opacity-50"
                    >
                      {aiLoading
                        ? (siteMode === 'widget' ? 'Generating Calculator...' : 'Generating Full Site...')
                        : (siteMode === 'widget' ? 'Generate Quote Calculator' : 'Generate Site & Calculator')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {aiWidgetConfig && (
              <div className="mt-6 p-4 bg-black/20 rounded border border-indigo-500/20">
                <h3 className="text-sm font-bold text-green-400 mb-2">✅ AI Generation Successful</h3>
                <p className="text-xs text-neutral-400 mb-2">The AI has generated <strong>{aiWidgetConfig.customRooms?.length || 0} custom services</strong> and <strong>{aiWidgetConfig.customAddOns?.length || 0} add-ons</strong> for the quote widget.{siteMode === 'full' ? ' The site content has been pre-filled below.' : ''}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {aiWidgetConfig.customRooms?.map((r: { name?: string }, i: number) => (
                    <span key={i} className="text-[10px] bg-neutral-800 border border-neutral-700 px-2 py-1 rounded">{r.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-300">Business Name</label>
              <input 
                type="text" 
                value={formData.businessName}
                onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-white"
                required
              />
            </div>

            {siteMode === 'full' && (
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-300">Subdomain</label>
              <div className="flex">
                <input 
                  type="text" 
                  value={formData.subdomain}
                  onChange={(e) => setFormData({...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                  className="w-full bg-neutral-900 border border-r-0 border-neutral-700 rounded-l-md p-2 text-white"
                  required
                />
                <span className="bg-neutral-700 border border-neutral-700 border-l-0 rounded-r-md p-2 text-neutral-400">
                  .localhost
                </span>
              </div>
            </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-300">Owner Login Email</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={formData.ownerEmail}
                onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-white"
                placeholder="owner@business.com"
                required
              />
              {isSandbox && (
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, ownerEmail: generateTestEmail() }))}
                  className="shrink-0 bg-neutral-700 hover:bg-neutral-600 text-white px-3 py-2 rounded-md text-xs font-bold transition-colors"
                  title="Generate a fake @example.com email for testing"
                >
                  Generate test email
                </button>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {isSandbox
                ? 'Testing mode: a fake @example.com address is pre-filled — use it as the login username. (Hidden on production.)'
                : 'This email is the username the owner uses to log in to their dashboard.'}
            </p>
          </div>

          {siteMode === 'full' && (
          <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-300">Aesthetic Theme</label>
              <select 
                value={formData.theme}
                onChange={(e) => setFormData({...formData, theme: e.target.value})}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-white"
              >
                <optgroup label="Original 3">
                  <option value="luxury-minimal">Luxury Minimal (Lumina)</option>
                  <option value="brutalist">Brutalist (Ironclad)</option>
                  <option value="classic-warm">Classic Warm (Hearth)</option>
                </optgroup>
                <optgroup label="New Extended 10">
                  <option value="modern-office">Modern Office</option>
                  <option value="playful-kids">Playful Kids Space</option>
                  <option value="rustic-pantry">Rustic Pantry</option>
                  <option value="sleek-entertainment">Sleek Entertainment</option>
                  <option value="elegant-dressing">Elegant Dressing Room</option>
                  <option value="functional-utility">Functional Utility</option>
                  <option value="creative-craft">Creative Craft Room</option>
                  <option value="sophisticated-wine">Sophisticated Wine Cellar</option>
                  <option value="cozy-library">Cozy Home Library</option>
                  <option value="minimalist-zen">Minimalist Zen</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-300">Structural Layout</label>
              <select 
                value={formData.layoutStyle}
                onChange={(e) => setFormData({...formData, layoutStyle: e.target.value})}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-white"
              >
                <option value="standard">Standard (Balanced Flow)</option>
                <option value="portfolio-first">Portfolio First (Visual Heavy)</option>
                <option value="conversion-focus">Conversion Focus (Calculator First)</option>
                <option value="storyteller">Storyteller (Narrative & Quiz First)</option>
                <option value="minimalist-lead">Minimalist Lead (Extremely Short)</option>
                <option value="visual-impact">Visual Impact (Images Only, No Text)</option>
              </select>
            </div>
          </div>

          <div className="border-t border-neutral-700 pt-4 mt-4">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4">Content Customization</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-300">Hero Headline</label>
                <input 
                  type="text" 
                  value={formData.heroHeadline}
                  onChange={(e) => setFormData({...formData, heroHeadline: e.target.value})}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-300">About Us Story</label>
                <textarea 
                  value={formData.aboutDescription}
                  onChange={(e) => setFormData({...formData, aboutDescription: e.target.value})}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-white min-h-[80px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-300">Main &apos;After&apos; Image URL (Hero & Slider)</label>
                <input 
                  type="text" 
                  value={formData.heroImage}
                  onChange={(e) => setFormData({...formData, heroImage: e.target.value})}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-white text-xs font-mono"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-300">Messy &apos;Before&apos; Image URL (Slider)</label>
                <input 
                  type="text" 
                  value={formData.beforeImage}
                  onChange={(e) => setFormData({...formData, beforeImage: e.target.value})}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-white text-xs font-mono"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 text-neutral-300">Services Offered (Portfolio Grid)</label>
                <div className="grid grid-cols-2 gap-3">
                  {availableServices.map(service => (
                    <label key={service} className="flex items-center space-x-2 cursor-pointer p-2 rounded bg-neutral-900 border border-neutral-700 hover:border-neutral-500 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={formData.services.includes(service)}
                        onChange={() => handleServiceToggle(service)}
                        className="rounded border-neutral-600 bg-neutral-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-neutral-900"
                      />
                      <span className="text-sm text-neutral-300">{service}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </>
          )}

          {siteMode === 'widget' && (
            <div className="border-t border-neutral-700 pt-4 mt-4 text-sm text-neutral-400">
              <p>Widget-only build (Pipeline A): no website is generated. Use the AI section above to build the Quote Calculator, then deploy to get an embeddable snippet for the prospect&apos;s existing site.</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md mt-6 transition-colors disabled:opacity-50"
          >
            {loading
              ? 'Provisioning Edge Architecture...'
              : (siteMode === 'widget' ? 'Deploy Quote Calculator' : 'Deploy Simulated Site')}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-900/50 border border-red-500 rounded-md text-red-200">
            {error}
          </div>
        )}

        {(resultUrl || embedSnippet) && (
          <div className="bg-green-900/30 border border-green-500/50 text-green-200 p-6 rounded-xl shadow-lg w-full max-w-3xl mt-8 flex flex-col items-center text-center">
            <svg className="w-12 h-12 text-green-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="text-xl font-bold text-green-400 mb-2">Provisioning Complete!</h3>
            <p className="mb-6 text-sm opacity-90">
              {resultMode === 'widget'
                ? 'The Quote Calculator is live. Paste the embed snippet below on the prospect\u2019s existing website.'
                : 'The environment is live on the Edge. The database, site configs, and custom widget settings are fully deployed.'}
            </p>

            {resultMode === 'full' && resultUrl && (
              <a 
                href={resultUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block bg-green-500 text-neutral-900 font-bold px-6 py-3 rounded-lg hover:bg-green-400 transition-colors mb-4"
              >
                Open Sandbox Environment
              </a>
            )}

            {resultMode === 'widget' && embedSnippet && (
              <div className="w-full text-left bg-black/20 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-green-400 uppercase tracking-wider font-bold">Embed Snippet</p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(embedSnippet)}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1 rounded text-xs border border-neutral-600"
                  >
                    Copy
                  </button>
                </div>
                <pre className="whitespace-pre-wrap break-all bg-neutral-900 border border-neutral-700 rounded-md p-3 text-xs text-white font-mono">{embedSnippet}</pre>
                <p className="text-xs text-neutral-400 mt-2">Paste this where the calculator should appear on their site.</p>
              </div>
            )}

            <div className="w-full text-left bg-black/20 rounded-lg p-4 space-y-2 font-mono text-sm">
              <p className="text-xs text-green-400 uppercase tracking-wider font-bold mb-2">Owner Login Credentials</p>
              {loginUrl && (
                <p className="break-all">
                  <span className="text-neutral-400">Login URL:</span>{' '}
                  <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="text-green-300 underline">{loginUrl}</a>
                </p>
              )}
              <p className="break-all"><span className="text-neutral-400">Email (username):</span> {loginEmail}</p>
              <p className="break-all"><span className="text-neutral-400">Temp Password:</span> {tempPassword}</p>
            </div>
            <p className="text-xs text-neutral-400 mt-2">The owner signs in with this email + temp password and is prompted to reset it on first login.</p>

            {/* Upsell only for widget-only (Pipeline A) builds — a full-website
                customer is already getting the site, so no upsell is shown. */}
            {resultMode === 'widget' && aiUpsellPitch && (
              <div className="mt-8 text-left bg-black/30 p-5 rounded-lg border border-green-500/30 w-full">
                <h4 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  Full-Website Upsell Pitch
                </h4>
                <p className="text-sm text-neutral-300 italic mb-4">Send this to pitch the prospect a full website to go with their new calculator:</p>
                <div className="relative group">
                  <textarea 
                    readOnly
                    value={aiUpsellPitch}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-4 text-white min-h-[100px] text-sm leading-relaxed cursor-text"
                  />
                  <button 
                    onClick={() => navigator.clipboard.writeText(aiUpsellPitch)}
                    className="absolute top-2 right-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 p-2 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity border border-neutral-600"
                  >
                    Copy Text
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
