// ============================================
// AI Landscape — Daily Cron Handler
// Runs daily at 07:00 UTC (09:00 Berlin CEST / 08:00 CET)
//
// What it does:
// 1. Fetches latest AI news via Google News RSS (last 7 days)
// 2. Asks Groq LLM to refresh AI systems data with current-date awareness
// 3. Cleans up past events (older than 1 month)
// 4. Writes everything to Supabase
// 5. Updates ai_meta timestamps
// ============================================

const Groq = require('groq-sdk');

module.exports = async function handler(req, res) {
  const startTime = Date.now();
  const results = { systems: 0, news: 0, events_cleaned: 0, errors: [] };

  try {
    // Auth check — only Vercel Cron or requests with secret
    const cronSecret = process.env.CRON_SECRET_AI_LANDSCAPE;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const authHeader = req.headers.authorization;
    if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL_AI_LANDSCAPE;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY_AI_LANDSCAPE;
    const GROQ_KEY = process.env.GROQ_API_KEY_AI_LANDSCAPE;

    if (!SUPABASE_URL || !SUPABASE_KEY || !GROQ_KEY) {
      return res.status(500).json({ error: 'Missing env vars' });
    }

    const sbHeaders = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    };

    const groq = new Groq({ apiKey: GROQ_KEY });
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);

    // ============================================
    // 1. NEWS — Google News RSS
    // ============================================
    try {
      const newsQueries = [
        { q: 'GPT OpenAI ChatGPT release 2026', cat: 'release' },
        { q: 'Claude Anthropic release 2026', cat: 'release' },
        { q: 'Gemini Google DeepMind release 2026', cat: 'release' },
        { q: 'Llama Meta open source AI 2026', cat: 'release' },
        { q: 'AI funding round billion 2026', cat: 'funding' },
        { q: 'EU AI Act regulation 2026', cat: 'regulation' },
        { q: 'AI coding tool Cursor Copilot 2026', cat: 'release' },
        { q: 'DeepSeek Qwen Chinese AI 2026', cat: 'release' },
      ];

      const fetchedNews = [];
      for (const q of newsQueries) {
        try {
          const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q.q)}&hl=en&gl=US&ceid=US:en`;
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AILandscapeBot/1.0)' } });
          if (!r.ok) continue;
          const xml = await r.text();
          const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
          for (const item of items.slice(0, 3)) {
            const title = (item.match(/<title>(.*?)<\/title>/) || [])[1] || '';
            const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
            const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
            const source = (item.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || 'Google News';
            const cleanTitle = title.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
            const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : todayISO;
            // Skip old news (>14 days)
            if ((Date.now() - new Date(pubDate).getTime()) > 14 * 24 * 60 * 60 * 1000) continue;
            // Generate stable id from URL
            const id = link.split('/articles/')[1]?.slice(0, 40)?.replace(/[^a-zA-Z0-9]/g, '_') || `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            fetchedNews.push({
              id,
              title: cleanTitle.slice(0, 240),
              summary: cleanTitle.slice(0, 280),
              date,
              source,
              source_url: link,
              category: q.cat,
              importance: 'medium',
            });
          }
        } catch (e) {
          results.errors.push(`news query "${q.q}": ${e.message}`);
        }
      }

      // Deduplicate by title (first 60 chars)
      const seen = new Set();
      const dedupedNews = fetchedNews.filter(n => {
        const key = n.title.slice(0, 60).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 25);

      if (dedupedNews.length > 0) {
        // Upsert into ai_news (on conflict, update)
        const r = await fetch(`${SUPABASE_URL}/rest/v1/ai_news?on_conflict=id`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(dedupedNews),
        });
        if (!r.ok) throw new Error(`news upsert: HTTP ${r.status} ${await r.text()}`);
        results.news = dedupedNews.length;

        // Delete news older than 60 days
        const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await fetch(`${SUPABASE_URL}/rest/v1/ai_news?date=lt.${cutoff}`, { method: 'DELETE', headers: sbHeaders });
      }
    } catch (e) {
      results.errors.push(`news section: ${e.message}`);
    }

    // ============================================
    // 2. SYSTEMS — Groq LLM refresh
    // (Asks Groq to update only if there are real changes)
    // Throttled: only refresh if last update >24h ago
    // ============================================
    try {
      const metaR = await fetch(`${SUPABASE_URL}/rest/v1/ai_meta?key=eq.last_systems_update&select=value`, { headers: sbHeaders });
      const metaArr = await metaR.json();
      const lastUpdate = metaArr[0]?.value;
      const hoursSince = lastUpdate ? (Date.now() - new Date(lastUpdate).getTime()) / 3600000 : 999;

      if (hoursSince >= 23) {
        // Fetch existing systems for context
        const existingR = await fetch(`${SUPABASE_URL}/rest/v1/ai_systems?select=id,name,latest_model,market_position&order=type.asc,market_position.asc`, { headers: sbHeaders });
        const existing = await existingR.json();

        const prompt = `You are tracking the AI landscape. Today is ${todayISO}.

Here are the AI systems we track:
${JSON.stringify(existing, null, 0)}

Based on your knowledge of AI news through ${todayISO}, are there any UPDATES needed? Specifically:
- Has any system released a new flagship model since the dates implied by "latest_model"?
- Has any system been discontinued, acquired, or significantly changed?
- Are there any NEW major systems that should be added to this list?

Reply with ONLY a JSON object in this exact format (no markdown, no commentary):
{
  "updates": [
    {"id": "<existing_id>", "latest_model": "<new model name>"}
  ],
  "additions": [],
  "notes": "<one-line summary>"
}

If nothing has changed since the last update, return {"updates": [], "additions": [], "notes": "no changes"}.
Be conservative — only report changes you are confident about.`;

        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        });

        const refreshData = JSON.parse(completion.choices[0].message.content);
        const updates = refreshData.updates || [];

        // Apply updates (only latest_model field for safety)
        for (const u of updates) {
          if (!u.id || !u.latest_model) continue;
          await fetch(`${SUPABASE_URL}/rest/v1/ai_systems?id=eq.${u.id}`, {
            method: 'PATCH',
            headers: sbHeaders,
            body: JSON.stringify({ latest_model: u.latest_model, updated_at: new Date().toISOString() }),
          });
          results.systems++;
        }

        // Update meta timestamp
        await fetch(`${SUPABASE_URL}/rest/v1/ai_meta?key=eq.last_systems_update`, {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ value: new Date().toISOString(), updated_at: new Date().toISOString() }),
        });
      }
    } catch (e) {
      results.errors.push(`systems section: ${e.message}`);
    }

    // ============================================
    // 3. EVENTS — Clean up past ones
    // ============================================
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/ai_events?or=(date_end.lt.${cutoff},and(date_end.is.null,date_start.lt.${cutoff}))`, {
        method: 'DELETE',
        headers: { ...sbHeaders, 'Prefer': 'return=representation' },
      });
      if (r.ok) {
        const deleted = await r.json();
        results.events_cleaned = Array.isArray(deleted) ? deleted.length : 0;
      }
    } catch (e) {
      results.errors.push(`events cleanup: ${e.message}`);
    }

    // ============================================
    // 4. Update meta timestamps
    // ============================================
    const now = new Date().toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/ai_meta`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([
        { key: 'last_news_update', value: now, updated_at: now },
        { key: 'last_run', value: now, updated_at: now },
      ]),
    });

    const elapsed = Date.now() - startTime;
    return res.status(200).json({
      ok: true,
      elapsed_ms: elapsed,
      ...results,
    });
  } catch (err) {
    console.error('ai-landscape-update error:', err);
    return res.status(500).json({ error: err.message, ...results });
  }
};
