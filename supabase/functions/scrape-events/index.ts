// @ts-nocheck
// supabase/functions/scrape-events/index.ts

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const res = await fetch('https://myevents.tn/liste_evenement.php', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const html = await res.text()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const events = []
    const anchorRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let match

    while ((match = anchorRegex.exec(html)) !== null) {
      const [, href, inner] = match
      if (!inner.includes('À Venir')) continue

      const titleMatch = inner.match(/<h6[^>]*>([\s\S]*?)<\/h6>/)
      if (!titleMatch) continue
      const title = titleMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim()

      const dateMatch = inner.match(/(\d{4}-\d{2}-\d{2})/)
      if (!dateMatch) continue
      const date = dateMatch[1]

      const eventDate = new Date(date)
      eventDate.setHours(0, 0, 0, 0)
      if (eventDate < today) continue

      const imgMatch = inner.match(/<img[^>]+src="([^"]+)"/)
      let image = imgMatch ? imgMatch[1] : null
      if (image) {
        image = image.replace(/^\.\//, '')
        image = image.startsWith('http') ? image : `https://myevents.tn/${image}`
      }

      const afterTitle = inner.slice((titleMatch.index ?? 0) + titleMatch[0].length)
      const cleanText = afterTitle.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const beforeDate = cleanText.split(date)[0].trim()
      const location = beforeDate.replace(/Chargement\.\.\./g, '').trim() || null

      const fullHref = href.startsWith('http') ? href : `https://myevents.tn/${href}`
      events.push({ title, date, location, image, url: fullHref })
    }

    events.sort((a, b) => a.date.localeCompare(b.date))

    return new Response(JSON.stringify(events), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})