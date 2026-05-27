/** Shared CORS headers for edge API routes */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/** Standard preflight response for OPTIONS requests */
export function handleOptions() {
  return new Response(null, { status: 200, headers: corsHeaders })
}
