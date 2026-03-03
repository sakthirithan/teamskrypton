import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { sheetId, sheetName } = await req.json()

    if (!sheetId) {
      return new Response(JSON.stringify({ error: 'sheetId is required' }), { status: 400, headers: corsHeaders })
    }

    const tabName = sheetName || 'Sheet1'
    // Use Google Sheets public CSV export (sheet must be published to web)
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`

    const response = await fetch(url)
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch sheet: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const csvText = await response.text()

    // Parse CSV
    const rows = parseCSV(csvText)
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ headers: [], rows: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const headers = rows[0]
    const dataRows = rows.slice(1).map((row, idx) => {
      const obj: Record<string, string> = { __rowIndex: String(idx + 2) }
      headers.forEach((h, i) => {
        obj[h] = row[i] || ''
      })
      return obj
    })

    return new Response(
      JSON.stringify({ headers, rows: dataRows }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('fetch-google-sheet error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function parseCSV(csv: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    const next = csv[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(current.trim())
        current = ''
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        row.push(current.trim())
        rows.push(row)
        row = []
        current = ''
        if (char === '\r') i++
      } else {
        current += char
      }
    }
  }

  if (current || row.length > 0) {
    row.push(current.trim())
    rows.push(row)
  }

  return rows.filter(r => r.some(cell => cell !== ''))
}
