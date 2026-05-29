'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function SandboxOnboarding() {
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [error, setError] = useState('');

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
        body: JSON.stringify(formData)
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

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-6 py-12">
      <div className="max-w-2xl w-full bg-neutral-800 p-8 rounded-xl shadow-2xl border border-neutral-700">
        <h1 className="text-2xl font-bold mb-2">Onboarding Simulator</h1>
        <p className="text-neutral-400 mb-8 text-sm">Simulate a new contractor signing up and instantly provisioning their Edge-rendered site.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="mt-6 p-4 bg-green-900/50 border border-green-500 rounded-md text-center">
            <h3 className="text-green-300 font-bold mb-2">Success! Site Deployed.</h3>
            <p className="text-sm text-green-200 mb-4">Open this URL in a new tab to see your dynamic edge-rendered site:</p>
            <a href={resultUrl} target="_blank" rel="noopener noreferrer" className="inline-block bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold mb-4">
              Open {resultUrl}
            </a>
            
            {tempPassword && (
              <div className="bg-black/40 p-4 rounded-lg text-left mt-2 border border-green-500/30">
                <h4 className="text-green-400 font-bold mb-2 text-sm uppercase tracking-wider">Dashboard Credentials</h4>
                <p className="text-sm text-neutral-300 mb-1">Email: <span className="text-white font-mono">{formData.ownerEmail}</span></p>
                <p className="text-sm text-neutral-300 mb-2">Password: <span className="text-white font-mono select-all bg-black px-1 rounded">{tempPassword}</span></p>
                <p className="text-xs text-neutral-400 italic">An email was also sent via Resend. The user will be forced to change this password on login.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
