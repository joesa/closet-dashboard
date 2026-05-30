'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function SandboxOnboarding() {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [error, setError] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [sitemap, setSitemap] = useState<string[]>([]);
  const [isSitemapGenerated, setIsSitemapGenerated] = useState(false);
  const [aiUpsellPitch, setAiUpsellPitch] = useState('');
  const [aiWidgetConfig, setAiWidgetConfig] = useState<any>(null);
  const [aiSiteConfig, setAiSiteConfig] = useState<any>(null);

  const [formData, setFormData] = useState({
    businessName: 'Apex Garage Builds',
    theme: 'brutalist',
    layoutStyle: 'standard',
    subdomain: 'apex',
    ownerEmail: `sandbox-${Math.floor(Math.random() * 10000)}@test.com`,
    heroHeadline: 'Built For Garages That Dominate',
    aboutDescription: 'Apex Garage Builds engineers brutalist, high-performance garage environments for those who demand absolute durability.',
    heroImage: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
    beforeImage: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
    services: ['Walk-In Closets', 'Garages', 'Home Offices'] // Default selection
  });

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

    try {
      const res = await fetch('/api/sandbox/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          aiSiteConfig,
          aiWidgetConfig
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to provision');
      
      setResultUrl(data.url);
      setTempPassword(data.tempPassword || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSitemap = async () => {
    if (!aiInput.trim()) {
      setError('Please enter a URL or business description.');
      return;
    }
    
    if (pageCount === 1) {
      // Skip sitemap generation for 1-page sites
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
    } catch (err: any) {
      setError(err.message);
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
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center p-6 py-12">
      <div className="max-w-3xl w-full">
        <div className="bg-neutral-800 p-8 rounded-xl shadow-2xl border border-neutral-700 mb-8">
          <h1 className="text-2xl font-bold mb-2">Onboarding Simulator</h1>
          <p className="text-neutral-400 mb-8 text-sm">Simulate a new contractor signing up. Generate custom sites using AI.</p>

          {/* AI Generation Section */}
          <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-bold text-indigo-300 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              AI Smart Configuration
            </h2>
            <p className="text-sm text-indigo-200/70 mb-4">
              Paste their website URL to scrape it, or paste a description of their services. The AI will generate a highly tailored site and Quote Calculator.
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="https://getorganizedyall.com OR 'We are a local builder...'"
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-md p-3 text-white"
                  disabled={aiLoading || isSitemapGenerated}
                />
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
                {!isSitemapGenerated && (
                  <button 
                    type="button"
                    onClick={handleGenerateSitemap}
                    disabled={aiLoading || !aiInput}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-md font-bold transition-colors disabled:opacity-50"
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
                      {aiLoading ? 'Generating Full Site...' : 'Generate Site & Calculator'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {aiWidgetConfig && (
              <div className="mt-6 p-4 bg-black/20 rounded border border-indigo-500/20">
                <h3 className="text-sm font-bold text-green-400 mb-2">✅ AI Generation Successful</h3>
                <p className="text-xs text-neutral-400 mb-2">The AI has generated <strong>{aiWidgetConfig.customRooms?.length || 0} custom services</strong> and <strong>{aiWidgetConfig.customAddOns?.length || 0} add-ons</strong> for the quote widget. The site content has been pre-filled below.</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {aiWidgetConfig.customRooms?.map((r: any, i: number) => (
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
          </div>

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
                <label className="block text-sm font-medium mb-1 text-neutral-300">Main 'After' Image URL (Hero & Slider)</label>
                <input 
                  type="text" 
                  value={formData.heroImage}
                  onChange={(e) => setFormData({...formData, heroImage: e.target.value})}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2 text-white text-xs font-mono"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-300">Messy 'Before' Image URL (Slider)</label>
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

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md mt-6 transition-colors disabled:opacity-50"
          >
            {loading ? 'Provisioning Edge Architecture...' : 'Deploy Simulated Site'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-900/50 border border-red-500 rounded-md text-red-200">
            {error}
          </div>
        )}

        {resultUrl && (
          <div className="bg-green-900/30 border border-green-500/50 text-green-200 p-6 rounded-xl shadow-lg w-full max-w-3xl mt-8 flex flex-col items-center text-center">
            <svg className="w-12 h-12 text-green-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="text-xl font-bold text-green-400 mb-2">Provisioning Complete!</h3>
            <p className="mb-6 text-sm opacity-90">The environment is live on the Edge. The database, site configs, and custom widget settings are fully deployed.</p>
            
            <a 
              href={resultUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block bg-green-500 text-neutral-900 font-bold px-6 py-3 rounded-lg hover:bg-green-400 transition-colors mb-4"
            >
              Open Sandbox Environment
            </a>
            <p className="font-mono text-sm bg-black/20 p-2 rounded w-full">Temp Admin Password: {tempPassword}</p>

            {aiUpsellPitch && (
              <div className="mt-8 text-left bg-black/30 p-5 rounded-lg border border-green-500/30 w-full">
                <h4 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  AI Generated Upsell Pitch
                </h4>
                <p className="text-sm text-neutral-300 italic mb-4">Use this text in Instantly or your email follow-up:</p>
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
