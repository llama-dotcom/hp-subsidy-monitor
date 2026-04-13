// ============================================
// My News Hub — Read-only API
// Returns all news grouped by section
// ============================================

module.exports = async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL_NEWS_HUB;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY_NEWS_HUB;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Missing env vars' });
    }

    const sbH = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    };

    // Fetch all news ordered by date desc
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/news?select=*&order=published_at.desc&limit=200`,
      { headers: sbH }
    );
    if (!r.ok) throw new Error(`Supabase: HTTP ${r.status}`);
    const allNews = await r.json();

    // Group by section
    const grouped = {};
    const sections = ['politics', 'esslingen', 'saratov', 'beauty', 'carnivore', 'tech'];
    for (const s of sections) grouped[s] = [];

    for (const item of allNews) {
      if (grouped[item.section]) {
        grouped[item.section].push(item);
      }
    }

    // Cache: 5min browser, 1h CDN
    res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=300');
    return res.status(200).json(grouped);
  } catch (err) {
    console.error('news-hub-data error:', err);
    return res.status(500).json({ error: err.message });
  }
};
