'use client'

/**
 * Visit live site — blocks navigation while edit-in-place is ON.
 */
export default function VisitLiveSiteButton({
  liveUrl,
  editInPlace,
}: {
  liveUrl: string
  editInPlace: boolean
}) {
  if (editInPlace) {
    return (
      <button
        type="button"
        onClick={() => {
          window.alert(
            'Edit in place is ON. Public visitors see a holding page.\n\nTurn it off in Custom build before visiting the live site.'
          )
        }}
        className="px-6 py-3 bg-emerald-600/40 text-white/80 font-medium rounded-lg transition-colors flex items-center gap-2 border border-emerald-500/30 cursor-not-allowed"
        title="Turn off Edit in place first"
      >
        Visit live site (turn off edit-in-place first)
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </button>
    )
  }

  return (
    <a
      href={liveUrl}
      target="_blank"
      rel="noreferrer"
      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
    >
      Visit live site
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </a>
  )
}
