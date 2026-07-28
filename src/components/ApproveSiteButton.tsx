'use client'

export default function ApproveSiteButton({
  tenantId,
  editInPlace,
}: {
  tenantId: string
  editInPlace: boolean
}) {
  if (editInPlace) {
    return (
      <button
        type="button"
        onClick={() => {
          window.alert(
            'Edit in place is ON. Turn it off in Custom build before approving this site.'
          )
        }}
        className="px-6 py-3 bg-emerald-600/40 text-white/80 font-medium rounded-lg border border-emerald-500/30 cursor-not-allowed"
      >
        Approve & Go Live (turn off edit-in-place first)
      </button>
    )
  }

  return (
    <form action={`/api/admin/sites/approve`} method="POST">
      <input type="hidden" name="tenantId" value={tenantId} />
      <button
        type="submit"
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
      >
        Approve & Go Live
      </button>
    </form>
  )
}
