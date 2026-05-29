'use client';

import React, { useState, useRef } from 'react';

interface DeleteTenantDialogProps {
  tenantId: string;
  businessName: string;
  variant?: 'table' | 'detail';
}

export default function DeleteTenantDialog({ tenantId, businessName, variant = 'table' }: DeleteTenantDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue === businessName) {
      formRef.current?.submit();
    }
  };

  return (
    <>
      <button 
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          variant === 'table' 
            ? "text-xs font-medium text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider"
            : "px-6 py-3 bg-red-900/30 hover:bg-red-900/50 text-red-500 font-medium rounded-lg border border-red-500/20 transition-colors"
        }
      >
        Delete{variant === 'detail' && ' Tenant'}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Delete Tenant</h3>
            <p className="text-neutral-400 text-sm mb-6">
              This action cannot be undone. This will permanently delete the site, domain mapping, and all configuration for <span className="text-white font-semibold">{businessName}</span>.
            </p>

            <form ref={formRef} action="/api/admin/sites/delete" method="POST" onSubmit={handleDelete}>
              <input type="hidden" name="tenantId" value={tenantId} />
              
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-neutral-300">
                  Please type <span className="select-all bg-black/50 px-2 py-1 rounded text-red-400 font-mono">{businessName}</span> to confirm.
                </label>
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full bg-black/50 border border-neutral-700 rounded-md p-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                  placeholder={businessName}
                  required
                />
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => { setIsOpen(false); setInputValue(''); }}
                  className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={inputValue !== businessName}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-lg shadow-red-500/20"
                >
                  Delete Forever
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
