import { createClient } from '@supabase/supabase-js'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { assertEntitled } from '@/lib/gate'

export const runtime = 'edge'

export function OPTIONS() {
  return handleOptions()
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return Response.json({ error: 'Contractor ID is required' }, { status: 400, headers: corsHeaders })
    }

    const blocked = await assertEntitled(id)
    if (blocked) return blocked

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: settings, error } = await supabase
      .from('contractor_settings')
      .select('company_name, primary_color_hex')
      .eq('id', id)
      .single()

    if (error || !settings) {
      return Response.json({ error: 'Contractor not found' }, { status: 404, headers: corsHeaders })
    }

    return Response.json(settings, { status: 200, headers: corsHeaders })
  } catch {
    return Response.json({ error: 'Internal Server Error' }, { status: 500, headers: corsHeaders })
  }
}
