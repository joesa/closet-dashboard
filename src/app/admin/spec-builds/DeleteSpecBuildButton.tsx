'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2, X } from 'lucide-react'
import { deleteSpecBuildAction } from './actions'

function DeleteSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      {pending ? 'Deleting…' : 'Delete permanently'}
    </button>
  )
}

export default function DeleteSpecBuildButton({
  buildId,
  businessName,
  variant = 'table',
  disabledReason,
}: {
  buildId: string
  businessName: string
  variant?: 'table' | 'detail'
  disabledReason?: string | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={Boolean(disabledReason)}
        title={disabledReason || `Delete ${businessName} from the Spec Builds queue`}
        className={
          variant === 'detail'
            ? 'inline-flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40'
            : 'inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-gray-300'
        }
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-spec-build-${buildId}`}
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id={`delete-spec-build-${buildId}`}
                  className="text-lg font-semibold text-gray-900"
                >
                  Delete spec build?
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  This permanently removes <strong>{businessName}</strong> from the queue and
                  deletes its unprovisioned spec intake. This cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close delete confirmation"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form action={deleteSpecBuildAction} className="mt-6 flex justify-end gap-3">
              <input type="hidden" name="spec_build_id" value={buildId} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <DeleteSubmitButton />
            </form>
          </div>
        </div>
      )}
    </>
  )
}
