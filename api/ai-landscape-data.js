// ============================================
// AI Landscape — Read API
// Returns all data needed by the frontend in one JSON response.
// Reads from Supabase, no auth required (public data).
// ============================================

module.exports = async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL_AI_LANDSCAPE;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY_AI_LANDSCAPE;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Missing Supabase env vars' });
    }

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    };

    const fetchTable = async (path) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
      if (!r.ok) throw new Error(`Supabase ${path}: HTTP ${r.status}`);
      return r.json();
    };

    // Fetch all data in parallel
    const [systems, news, events, synergies, meta] = await Promise.all([
      fetchTable('ai_systems?select=*&order=type.asc,market_position.asc'),
      fetchTable('ai_news?select=*&order=date.desc&limit=30'),
      fetchTable('ai_events?select=*&order=date_start.asc'),
      fetchTable('ai_synergies?select=*&order=sort_order.asc'),
      fetchTable('ai_meta?select=*'),
    ]);

    // Split systems by type
    const llms = systems.filter(s => s.type === 'llm');
    const coding = systems.filter(s => s.type === 'coding');

    // Convert meta array to lookup object
    const metaObj = {};
    for (const m of meta) metaObj[m.key] = m.value;

    // Cache headers — 5 minute browser cache, 1 hour CDN
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({
      llms,
      coding,
      news,
      events,
      synergies,
      meta: metaObj,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('ai-landscape-data error:', err);
    return res.status(500).json({ error: err.message });
  }
};
